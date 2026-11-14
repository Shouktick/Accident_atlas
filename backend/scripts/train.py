"""Reproducible candidate comparison. Requires a real CSV and reviewed provenance.

Never run this script with synthetic rows and publish the result as real evaluation.
The shipped legacy artifact is left untouched; outputs go to a new directory.
"""

import argparse
import hashlib
import io
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
import sklearn
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit, train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.schemas.scenario import FEATURES  # noqa: E402


def fingerprint(blob):
    return hashlib.sha256(blob).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument(
        "manifest",
        type=Path,
        help="Reviewed JSON with verified, source, sha256, target, speed_unit and optional group/timestamp columns",
    )
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    source = json.loads(args.manifest.read_text())
    blob = args.csv.read_bytes()
    if not source.get("verified") or not source.get("source") or source.get("sha256") != fingerprint(blob):
        raise ValueError("Reviewed source and matching dataset fingerprint are required")
    if source.get("speed_unit") not in {"mph", "km/h"}:
        raise ValueError("Canonical speed units must be verified")
    frame = pd.read_csv(io.BytesIO(blob)).drop_duplicates()
    target = source["target"]
    if set(frame[target].unique()) != {"Slight", "Serious", "Fatal"}:
        raise ValueError("Target must have reviewed canonical Slight/Serious/Fatal meanings")
    if frame[FEATURES + [target]].isna().any().any():
        raise ValueError("Resolve missing features with a documented training-only preprocessing pipeline")
    split = "stratified 60/20/20"
    group = source.get("group_column")
    timestamp = source.get("timestamp_column")
    if timestamp:
        frame = frame.assign(_time=pd.to_datetime(frame[timestamp], utc=True, errors="raise")).sort_values(
            "_time"
        )
        train, validation, test = (
            frame.iloc[: int(len(frame) * 0.6)],
            frame.iloc[int(len(frame) * 0.6) : int(len(frame) * 0.8)],
            frame.iloc[int(len(frame) * 0.8) :],
        )
        split = "chronological 60/20/20"
    elif group:
        trainval_idx, test_idx = next(
            GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42).split(frame, groups=frame[group])
        )
        trainval, test = frame.iloc[trainval_idx], frame.iloc[test_idx]
        train_idx, val_idx = next(
            GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=43).split(
                trainval, groups=trainval[group]
            )
        )
        train, validation = trainval.iloc[train_idx], trainval.iloc[val_idx]
        split = f"group-separated approximately 60/20/20 on {group}"
    else:
        trainval, test = train_test_split(frame, test_size=0.2, stratify=frame[target], random_state=42)
        train, validation = train_test_split(
            trainval, test_size=0.25, stratify=trainval[target], random_state=43
        )
    for part in [train, validation, test]:
        if set(part[target].unique()) != {"Slight", "Serious", "Fatal"}:
            raise ValueError("Every evaluation partition must contain all three classes")
    candidates = {
        "random_forest": RandomForestClassifier(
            n_estimators=200, max_depth=20, class_weight="balanced", random_state=42, n_jobs=1
        ),
        "hist_gradient_boosting": HistGradientBoostingClassifier(class_weight="balanced", random_state=42),
    }
    comparison = []
    for name, model in candidates.items():
        model.fit(train[FEATURES], train[target])
        validation_f1 = f1_score(validation[target], model.predict(validation[FEATURES]), average="macro")
        comparison.append({"candidate": name, "validation_macro_f1": validation_f1})
    winner = max(comparison, key=lambda row: row["validation_macro_f1"])["candidate"]
    model = candidates[winner]
    # Keep training fixed after selection; the untouched test is evaluated once.
    predicted, probabilities = model.predict(test[FEATURES]), model.predict_proba(test[FEATURES])
    version = f"{winner}-{fingerprint(blob)[:12]}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    metrics = {
        "model_version": version,
        "dataset_sha256": fingerprint(blob),
        "source": source["source"],
        "evaluation_set": "held_out_test",
        "split": split,
        "seed": 42,
        "class_labels": list(model.classes_),
        "partitions": {"train": len(train), "validation": len(validation), "test": len(test)},
        "accuracy": accuracy_score(test[target], predicted),
        "macro_f1": f1_score(test[target], predicted, average="macro"),
        "weighted_f1": f1_score(test[target], predicted, average="weighted"),
        "classification_report": classification_report(
            test[target], predicted, labels=model.classes_, output_dict=True, zero_division=0
        ),
        "confusion_matrix": confusion_matrix(test[target], predicted, labels=model.classes_).tolist(),
        "roc_auc_ovr_macro": roc_auc_score(
            test[target], probabilities, multi_class="ovr", labels=model.classes_
        ),
        "comparison": comparison,
        "selected_model": winner,
        "calibrated": False,
        "training_configuration": model.get_params(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    args.output.mkdir(parents=True, exist_ok=False)
    model_buffer, names_buffer = io.BytesIO(), io.BytesIO()
    joblib.dump(model, model_buffer)
    joblib.dump(FEATURES, names_buffer)
    model_bytes, names_bytes = model_buffer.getvalue(), names_buffer.getvalue()
    archive = args.output / "rf_model.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("rf_model.pkl", model_bytes)
        zip_file.writestr("feature_names.pkl", names_bytes)
    manifest = {
        "model_version": version,
        "archive_sha256": fingerprint(archive.read_bytes()),
        "model_sha256": fingerprint(model_bytes),
        "features_sha256": fingerprint(names_bytes),
        "sklearn_version": sklearn.__version__,
        "feature_order": FEATURES,
        "semantics_verified": True,
        "class_labels": {str(c): str(c) for c in model.classes_},
        "speed_unit": source["speed_unit"],
        "calibrated": False,
        "provenance": source["source"],
        "limitations": [
            "Not calibrated; estimates do not represent the chance of an accident.",
            "What-If comparisons are associative, not causal.",
        ],
    }
    (args.output / "model_metadata.json").write_text(json.dumps(manifest, indent=2))
    (args.output / "metrics.json").write_text(json.dumps(metrics, indent=2, default=str))
    print(f"Saved a new version in {args.output}; legacy artifacts were not replaced.")


if __name__ == "__main__":
    main()

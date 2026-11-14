"""Dataset capabilities exist only with a verified, fingerprinted source manifest."""

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd


class DataUnavailable(Exception):
    pass


class DatasetService:
    def __init__(self, settings):
        self.frame = None
        self.manifest = None
        self.global_cache = None
        if settings.dataset_path and settings.dataset_manifest:
            manifest = json.loads(Path(settings.dataset_manifest).read_text(encoding="utf-8"))
            path = Path(settings.dataset_path)
            if (
                not manifest.get("verified")
                or not manifest.get("source")
                or path.stat().st_size > 100 * 1024 * 1024
            ):
                raise ValueError("Dataset needs verified provenance and must fit the load budget")
            if hashlib.sha256(path.read_bytes()).hexdigest() != manifest["sha256"]:
                raise ValueError("Dataset fingerprint mismatch")
            self.frame = pd.read_csv(path)
            self.manifest = manifest

    def require(self):
        if self.frame is None:
            raise DataUnavailable(
                "The original dataset is unavailable. No accident records or dataset analytics have been invented."
            )
        return self.frame.copy()

    def provenance(self):
        return {
            "source": self.manifest["source"],
            "sha256": self.manifest["sha256"],
            "record_count": len(self.frame),
        }

    def overview(self):
        frame = self.require()
        target = self.manifest["target"]
        return {
            "provenance": self.provenance(),
            "row_count": len(frame),
            "distribution": [
                {"label": str(k), "count": int(v)}
                for k, v in frame[target].value_counts(dropna=False).items()
            ],
            "missing_values": int(frame.isna().sum().sum()),
            "duplicate_rows": int(frame.duplicated().sum()),
        }

    def aggregate(self, dimension: str, weather: int | None = None, vehicle: int | None = None):
        frame = self.require()
        for column, value in [("Weather_Conditions", weather), ("Vehicle_Type", vehicle)]:
            if value is not None:
                frame = frame[frame[column] == value]
        columns = {
            "weather": "Weather_Conditions",
            "road-surface": "Road_Surface_Conditions",
            "lighting": "Light_Conditions",
            "vehicle": "Vehicle_Type",
        }
        if dimension in columns:
            group = frame[columns[dimension]].astype(str)
        elif dimension == "age-groups":
            group = pd.cut(frame["Age_of_Driver"], [0, 25, 40, 60, 100], include_lowest=True).astype(str)
        elif dimension == "speed-bands":
            group = pd.cut(frame["Speed_limit"], [0, 30, 50, 70, 100, 200], include_lowest=True).astype(str)
        elif dimension in {"hourly", "weekday"}:
            timestamp = self.manifest.get("timestamp_column")
            if not timestamp or timestamp not in frame:
                raise DataUnavailable("This dataset has no verified timestamp field.")
            dates = pd.to_datetime(frame[timestamp], errors="coerce", utc=True)
            group = dates.dt.hour if dimension == "hourly" else dates.dt.day_name()
        else:
            raise DataUnavailable("This aggregate is not supported.")
        grouped = frame.assign(group=group).groupby(["group", self.manifest["target"]], observed=True).size()
        return {
            "dimension": dimension,
            "provenance": self.provenance(),
            "denominator": len(frame),
            "items": [{"group": str(k[0]), "label": str(k[1]), "count": int(v)} for k, v in grouped.items()],
        }

    def hotspots(
        self, severity="", weather: int | None = None, vehicle: int | None = None, hour: int | None = None
    ):
        frame = self.require()
        lat, lon = self.manifest.get("latitude_column"), self.manifest.get("longitude_column")
        if not lat or not lon or lat not in frame or lon not in frame:
            raise DataUnavailable("No verified accident coordinates exist in this dataset.")
        if severity:
            frame = frame[frame[self.manifest["target"]].astype(str) == severity]
        for column, value in [("Weather_Conditions", weather), ("Vehicle_Type", vehicle)]:
            if value is not None:
                frame = frame[frame[column] == value]
        if hour is not None:
            timestamp = self.manifest.get("timestamp_column")
            if not timestamp or timestamp not in frame:
                raise DataUnavailable("Time filtering requires a verified timestamp column.")
            frame = frame[pd.to_datetime(frame[timestamp], errors="coerce", utc=True).dt.hour == hour]
        frame[lat] = pd.to_numeric(frame[lat], errors="coerce")
        frame[lon] = pd.to_numeric(frame[lon], errors="coerce")
        frame = frame[frame[lat].between(6, 38) & frame[lon].between(68, 98)].dropna(subset=[lat, lon])
        # Bound response and preserve a count of omitted observations; no city-to-coordinate guessing.
        total = len(frame)
        city = self.manifest.get("city_column")
        return {
            "provenance": self.provenance(),
            "total": total,
            "truncated": total > 2000,
            "items": [
                {
                    "lat": float(row[lat]),
                    "lng": float(row[lon]),
                    "severity": str(row[self.manifest["target"]]),
                    "city": str(row[city]) if city and city in row and pd.notna(row[city]) else "Unspecified",
                }
                for _, row in frame.head(2000).iterrows()
            ],
        }

    def global_shap(self, model):
        frame = self.require()
        if model.explainer is None:
            raise DataUnavailable("The SHAP explainer is not available.")
        if self.global_cache is None:
            sample = (
                frame[model.manifest["feature_order"]]
                .dropna()
                .sample(n=min(32, len(frame.dropna(subset=model.manifest["feature_order"]))), random_state=42)
            )
            if sample.empty:
                raise DataUnavailable("No complete feature rows are available for global SHAP.")
            with model.lock:
                values = np.asarray(model.explainer.shap_values(sample, check_additivity=True))
            importance = np.abs(values).mean(axis=(0, 2))
            self.global_cache = {
                "provenance": self.provenance(),
                "sample_size": len(sample),
                "method": "Mean absolute Tree SHAP across sampled rows and model classes; tree-path background",
                "items": [{"feature": f, "importance": float(v)} for f, v in zip(sample.columns, importance)],
                "dependence": [
                    {
                        "feature": f,
                        "class_id": str(c),
                        "points": [
                            {"value": float(sample.iloc[i][f]), "contribution": float(values[i, j, k])}
                            for i in range(len(sample))
                        ],
                    }
                    for j, f in enumerate(sample.columns)
                    for k, c in enumerate(model.model.classes_)
                ],
            }
        return self.global_cache

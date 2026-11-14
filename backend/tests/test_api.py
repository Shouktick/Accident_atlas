import csv
import io
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.services.model import ModelService, severity_index
from app.services.batch import safe_cell
from test_scenario import VALID

HEADERS = {"Authorization": "Bearer " + "a" * 64}
OTHER = {"Authorization": "Bearer " + "b" * 64}


@pytest.fixture(scope="module")
def model():
    service = ModelService(Settings())
    service.initialize()
    assert service.model is not None, service.failure
    assert service.explainer is not None
    return service


@pytest.fixture(scope="module")
def client(model, tmp_path_factory):
    settings = Settings(database_url=f"sqlite:///{(tmp_path_factory.mktemp('db') / 'test.db').as_posix()}")
    with TestClient(create_app(settings, model)) as client:
        yield client


def test_health_and_metadata(client):
    health = client.get("/health").json()
    assert health["ready"] and health["model_available"] and health["database_available"]
    assert not health["severity_ready"] and not health["semantics_verified"]
    metadata = client.get("/model/metadata").json()
    assert metadata["speed_unit"] == "unverified"
    assert metadata["classes"] == [{"id": str(i), "label": f"Class {i}"} for i in [1, 2, 3]]
    assert client.get("/api/v1/health").status_code == 200


def test_actual_inference_and_shap(client):
    response = client.post("/predict", json={"scenario": VALID, "explain": True}, headers=HEADERS)
    assert response.status_code == 200, response.text
    result = response.json()
    probabilities = result["probabilities"]
    assert sum(p["probability"] for p in probabilities) == pytest.approx(1)
    assert result["class_id"] == max(probabilities, key=lambda p: p["probability"])["class_id"]
    assert result["confidence"] == max(p["probability"] for p in probabilities)
    assert result["risk_score"] is None and result["severity"].startswith("Class ")
    explanation = result["explanation"]
    assert explanation is not None
    assert explanation["base_value"] + sum(
        c["contribution"] for c in explanation["contributions"]
    ) == pytest.approx(result["confidence"], abs=1e-5)
    assert len(explanation["contributions"]) == 7


def test_invalid_and_missing_auth(client):
    assert client.post("/predict", json={"scenario": VALID}).status_code == 401
    invalid = VALID | {"Vehicle_Type": 999}
    response = client.post("/predict", json={"scenario": invalid}, headers=HEADERS)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_INPUT"
    assert "input" not in response.json()["error"]["details"][0]


def test_history_owner_and_delete(client):
    result = client.post(
        "/predict", json={"scenario": VALID, "save": True, "explain": False}, headers=HEADERS
    ).json()
    record_id = result["id"]
    assert client.get(f"/predictions/{record_id}", headers=HEADERS).json()["id"] == record_id
    assert client.get(f"/predictions/{record_id}", headers=OTHER).status_code == 404
    assert client.delete(f"/predictions/{record_id}", headers=OTHER).status_code == 404
    history = client.get("/predictions", headers=HEADERS).json()
    assert any(r["id"] == record_id for r in history["items"])
    assert client.get("/predictions?search=%27%20OR%201=1--", headers=HEADERS).json()["total"] == 0
    assert client.delete(f"/predictions/{record_id}", headers=HEADERS).status_code == 204
    assert client.get(f"/predictions/{record_id}", headers=HEADERS).status_code == 404


def test_whatif_and_sweep(client):
    response = client.post(
        "/predict/whatif",
        headers=HEADERS,
        json={"baseline": VALID, "scenarios": [VALID | {"Speed_limit": 70}], "find_best_change": True},
    )
    result = response.json()
    assert response.status_code == 200
    assert result["scenarios"][0]["feature_differences"] == ["Speed_limit"]
    assert result["scenarios"][0]["risk_delta"] is None and result["best_change"] is None
    sweep = client.post(
        "/predict/speed-sweep", headers=HEADERS, json={"scenario": VALID, "start": 20, "stop": 40, "step": 10}
    )
    assert [p["speed"] for p in sweep.json()["points"]] == [20, 30, 40]
    assert (
        client.post(
            "/predict/speed-sweep", headers=HEADERS, json={"scenario": VALID, "start": 60, "stop": 20}
        ).status_code
        == 422
    )


def make_csv(rows):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[*VALID, "note"])
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode()


def test_batch_validation_export_and_mapping(client):
    blob = make_csv([VALID | {"note": '=HYPERLINK("bad")'}, VALID | {"Vehicle_Type": 999, "note": "invalid"}])
    preview = client.post("/batch/preview", files={"file": ("test.CSV", blob)}, headers=HEADERS)
    assert preview.status_code == 200 and preview.json()["row_count"] == 2
    response = client.post("/predict/batch", files={"file": ("test.csv", blob)}, headers=HEADERS)
    result = response.json()
    assert response.status_code == 200, response.text
    assert result["successful"] == 1 and result["invalid"] == 1
    assert result["rows"][0]["row"] == 2 and result["rows"][1]["row"] == 3
    assert result["rows"][0]["input"]["note"].startswith("=")
    exported = list(csv.DictReader(io.StringIO(result["csv"])))
    assert exported[0]["input:note"].startswith("'=")
    assert exported[1]["result:status"] == "invalid"
    renamed = blob.replace(b"Speed_limit", b"speed")
    mapping = {f: "speed" if f == "Speed_limit" else f for f in VALID}
    mapped = client.post(
        "/predict/batch",
        files={"file": ("test.csv", renamed)},
        data={"mapping": json.dumps(mapping)},
        headers=HEADERS,
    )
    assert mapped.json()["successful"] == 1
    assert (
        client.post("/predict/batch", files={"file": ("test.csv", b"x\n1\n")}, headers=HEADERS).status_code
        == 422
    )
    assert (
        client.post("/predict/batch", files={"file": ("test.txt", blob)}, headers=HEADERS).status_code == 422
    )
    assert (
        client.post(
            "/predict/batch", files={"file": ("test.csv", b"a,a\n1,2\n")}, headers=HEADERS
        ).status_code
        == 422
    )


def test_limits_and_data_unavailable(client):
    assert (
        client.post(
            "/predict/batch", files={"file": ("test.csv", b"a" * (2 * 1024 * 1024 + 1))}, headers=HEADERS
        ).status_code
        == 413
    )
    many = make_csv([VALID | {"note": ""}] * 251)
    assert (
        client.post("/predict/batch", files={"file": ("test.csv", many)}, headers=HEADERS).status_code == 413
    )
    for path in [
        "/metrics",
        "/model-metrics",
        "/hotspots",
        "/insights/overview",
        "/insights/hourly",
        "/explain/global",
    ]:
        response = client.get(path)
        assert response.status_code == 503, path
        assert response.json()["error"]["code"] == "CAPABILITY_UNAVAILABLE"
    assert client.get("/activity", headers=HEADERS).json()["prediction_count"] >= 1


def test_index_is_gated_and_documented():
    probabilities = [
        {"label": "Slight", "probability": 0.5},
        {"label": "Serious", "probability": 0.3},
        {"label": "Fatal", "probability": 0.2},
    ]
    assert severity_index(probabilities, False) is None
    assert severity_index(probabilities, True) == 35
    assert safe_cell("  =1+1").startswith("'")


def test_failed_model_never_returns_fake_predictions(tmp_path):
    manifest = json.loads(Settings().model_manifest.read_text())
    manifest["archive_sha256"] = "0" * 64
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(manifest))
    settings = Settings(model_manifest=path, database_url="sqlite:///:memory:", shap_enabled=False)
    with TestClient(create_app(settings)) as broken:
        assert not broken.get("/health").json()["ready"]
        response = broken.post("/predict", headers=HEADERS, json={"scenario": VALID})
        assert response.status_code == 503
        assert "Traceback" not in response.text and str(Path.cwd()) not in response.text


def test_rate_limit(model):
    settings = Settings(database_url="sqlite:///:memory:", requests_per_minute=2)
    with TestClient(create_app(settings, model)) as limited:
        assert limited.get("/model/metadata").status_code == 200
        assert limited.get("/model/metadata").status_code == 200
        response = limited.get("/model/metadata")
        assert response.status_code == 429 and response.headers["Retry-After"] == "60"
        assert limited.get("/health").status_code == 200

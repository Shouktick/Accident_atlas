"""Small synthetic fixtures test aggregation plumbing only, never model performance."""

import hashlib
import json

import pytest

from app.core.config import Settings
from app.services.dataset import DataUnavailable, DatasetService


def test_verified_fixture_aggregates_and_geography(tmp_path):
    blob = b"Age_of_Driver,Speed_limit,Weather_Conditions,Road_Surface_Conditions,Light_Conditions,Vehicle_Type,Number_of_Vehicles,severity,lat,lon,time\n35,30,1,1,1,1,1,Slight,28.6,77.2,2025-01-01T12:00:00Z\n60,50,2,2,4,2,2,Serious,999,77.2,2025-01-02T18:00:00Z\n"
    path = tmp_path / "fixture.csv"
    path.write_bytes(blob)
    manifest = {
        "verified": True,
        "source": "Synthetic test fixture only; not observed accidents",
        "sha256": hashlib.sha256(blob).hexdigest(),
        "target": "severity",
        "latitude_column": "lat",
        "longitude_column": "lon",
        "timestamp_column": "time",
    }
    mp = tmp_path / "manifest.json"
    mp.write_text(json.dumps(manifest))
    data = DatasetService(Settings(dataset_path=str(path), dataset_manifest=str(mp)))
    assert data.overview()["row_count"] == 2
    assert sum(i["count"] for i in data.aggregate("weather")["items"]) == 2
    assert data.aggregate("hourly", weather=1)["items"][0]["group"] == "12"
    assert data.hotspots()["total"] == 1
    manifest["sha256"] = "0" * 64
    mp.write_text(json.dumps(manifest))
    with pytest.raises(ValueError):
        DatasetService(Settings(dataset_path=str(path), dataset_manifest=str(mp)))


def test_no_dataset_is_explicitly_unavailable():
    with pytest.raises(DataUnavailable):
        DatasetService(Settings()).overview()

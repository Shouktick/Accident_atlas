import pytest
from pydantic import ValidationError

from app.schemas.scenario import Scenario, SweepRequest

VALID = dict(Age_of_Driver=35, Speed_limit=30, Weather_Conditions=1,
             Road_Surface_Conditions=1, Light_Conditions=1, Vehicle_Type=1, Number_of_Vehicles=1)


def test_valid_scenario():
    assert Scenario(**VALID).Speed_limit == 30


@pytest.mark.parametrize("key,value", [("Age_of_Driver", -1), ("Speed_limit", -1),
    ("Vehicle_Type", 99), ("Weather_Conditions", 0), ("Number_of_Vehicles", 0)])
def test_invalid_scenarios(key, value):
    with pytest.raises(ValidationError):
        Scenario(**(VALID | {key: value}))


def test_sweep_bounds():
    with pytest.raises(ValidationError):
        SweepRequest(scenario=VALID, start=80, stop=20)

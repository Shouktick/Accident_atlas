"""Operational bounds are not claims about the original training distribution."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

FEATURES = [
    "Age_of_Driver",
    "Speed_limit",
    "Weather_Conditions",
    "Road_Surface_Conditions",
    "Light_Conditions",
    "Vehicle_Type",
    "Number_of_Vehicles",
]


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    Age_of_Driver: int = Field(ge=16, le=100)
    Speed_limit: int = Field(ge=10, le=140)
    Weather_Conditions: Literal[1, 2, 3, 4, 5, 6, 7]
    Road_Surface_Conditions: Literal[1, 2, 3, 4, 5]
    Light_Conditions: Literal[1, 4, 5, 6]
    Vehicle_Type: Literal[1, 2, 5, 8, 11]
    Number_of_Vehicles: int = Field(ge=1, le=20)


class PredictionRequest(BaseModel):
    scenario: Scenario
    save: bool = False
    explain: bool = True


class WhatIfRequest(BaseModel):
    baseline: Scenario
    scenarios: list[Scenario] = Field(min_length=1, max_length=8)
    find_best_change: bool = False


class SweepRequest(BaseModel):
    scenario: Scenario
    start: int = Field(default=20, ge=10, le=140)
    stop: int = Field(default=100, ge=10, le=140)
    step: int = Field(default=10, ge=5, le=50)

    @model_validator(mode="after")
    def ordered(self):
        if self.stop < self.start:
            raise ValueError("stop must be greater than or equal to start")
        if (self.stop - self.start) // self.step + 1 > 27:
            raise ValueError("A sweep is limited to 27 points")
        return self

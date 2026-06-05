from datetime import date
from pydantic import BaseModel, Field


class TripStop(BaseModel):
    city: str
    airport: str | None = None
    days: int = Field(default=1, ge=1)
    activity_categories: list[str] = Field(default_factory=list)


class TripPlanRequest(BaseModel):
    origin_airport: str
    outbound_date: date
    currency: str = "CAD"
    stops: list[TripStop] = Field(default_factory=list)
    return_to_origin: bool = True
    include_activities: bool = True
    include_weather: bool = True

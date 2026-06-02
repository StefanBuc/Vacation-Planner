from datetime import date
from pydantic import BaseModel

class TripPlanRequest(BaseModel):
    origin_airport: str
    destination_airport: str
    destination_city: str
    outbound_date: date
    return_date: date
    currency: str = "CAD"
    include_activities: bool = True
    include_weather: bool = True
    activity_categories: list[str] = []
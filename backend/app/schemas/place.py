from pydantic import BaseModel

class PlaceOption(BaseModel):
    name: str
    latitude: float | None = None
    longitude: float | None = None
    description: str | None = None
    weather: str | None = None
    attractions: list[str] | None = None
    restaurants: list[str] | None = None
    hotels: list[str] | None = None
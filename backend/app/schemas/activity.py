from pydantic import BaseModel

class ActivityOption(BaseModel):
    name: str
    description: str
    longitude: float
    latitude: float
    price: int
    duration_minutes: int
    type: str
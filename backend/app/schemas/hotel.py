from pydantic import BaseModel

class HotelOption(BaseModel):
    name: str
    latitude: float | None = None
    longitude: float | None = None
    rating: float
    price_per_night: float
    checkin_date: str
    checkout_date: str
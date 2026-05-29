from fastapi import APIRouter, HTTPException
from app.services.hotels_service import fetch_hotels

router = APIRouter(prefix="/hotels", tags=["hotels"])

@router.get("/{destination}/{checkin_date}/{checkout_date}/{currency}")
def get_hotels(destination: str, checkin_date: str, checkout_date: str, currency: str):
    try:
        return fetch_hotels(destination, checkin_date, checkout_date, currency)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

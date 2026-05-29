from fastapi import APIRouter, HTTPException
from app.services.flights_service import fetch_flights


router = APIRouter(prefix="/flights", tags=["flights"])

@router.get("/{origin}/{destination}/{currency}/{outbound_date}/{return_date}")
def get_flights(origin: str, destination: str, currency: str, outbound_date: str, return_date: str):
    try:
        return fetch_flights(origin, destination, currency, outbound_date, return_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail="Flights provider request failed.")

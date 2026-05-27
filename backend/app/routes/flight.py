from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.services.flights_service import fetch_flights


router = APIRouter(prefix="/flights", tags=["flights"])

@router.get("/{origin}/{destination}/{currency}/{outbound_date}/{return_date}")
def get_flights(background_tasks: BackgroundTasks, origin: str, destination: str, currency: str, outbound_date: str, return_date: str):
    try:
        background_tasks.add_task(fetch_flights, origin, destination, currency, outbound_date, return_date)
        return {"message": "Flight search initiated. Results will be available shortly."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
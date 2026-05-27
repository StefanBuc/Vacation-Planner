from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.services.hotels_service import fetch_hotels

router = APIRouter(prefix="/hotels", tags=["hotels"])

@router.get("/{destination}/{checkin_date}/{checkout_date}/{currency}")
def get_hotels(background_tasks: BackgroundTasks, destination: str, checkin_date: str, checkout_date: str, currency: str):
    try:
        background_tasks.add_task(fetch_hotels, destination, checkin_date, checkout_date, currency)
        return {"message": "Hotel search initiated. Results will be available shortly."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
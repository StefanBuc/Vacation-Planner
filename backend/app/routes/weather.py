from fastapi import APIRouter, HTTPException
from app.services.weather_service import fetch_weather
import datetime

router = APIRouter(prefix="/weather", tags=["weather"])

@router.get("/{destination}/{date}")
def get_weather(destination: str, date: str):
    try:
        date_obj = datetime.datetime.strptime(date, "%Y-%m-%d").date()
        return fetch_weather(destination, date_obj)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

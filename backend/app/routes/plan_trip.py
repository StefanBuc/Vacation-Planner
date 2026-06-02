from fastapi import APIRouter, HTTPException
from app.schemas.trip_plan import TripPlanRequest
from app.services.activity_service import get_activities
from app.services.weather_service import get_weather
from app.services.hotels_service import fetch_hotels
from app.services.flights_service import fetch_flights
from app.services.ai_service import generate_trip_plan

router = APIRouter(prefix="/plan-trip", tags=["plan-trip"])

@router.post("/")
def plan_trip(request: TripPlanRequest):
    try:
        flights = fetch_flights(
            request.origin_airport,
            request.destination_airport,
            request.currency,
            request.outbound_date.isoformat(),
            request.return_date.isoformat()
        )

        hotels = fetch_hotels(
            request.destination_city,
            request.outbound_date.isoformat(),
            request.return_date.isoformat(),
            request.currency
        )

        trip_activities = (
            get_activities(request.destination_city, request.activity_categories)
            if request.include_activities
            else []
        )

        trip_weather = (
            get_weather(request.destination_city, request.outbound_date)
            if request.include_weather
            else None
        )

        trip_data = {
            "flights": flights,
            "hotels": hotels,
            "activities": trip_activities,
            "weather": trip_weather
        }
        
        ai_plan = generate_trip_plan(trip_data)
        
        return {
            "trip_data": trip_data,
            "ai_plan": ai_plan
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
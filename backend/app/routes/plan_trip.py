import datetime
from fastapi import APIRouter, HTTPException
from app.schemas.trip_plan import TripPlanRequest, TripStop
from app.services.activity_service import fetch_activities
from app.services.weather_service import fetch_weather
from app.services.hotels_service import fetch_hotels
from app.services.flights_service import fetch_flights
from app.services.ai_service import generate_trip_plan

router = APIRouter(prefix="/plan-trip", tags=["plan-trip"])


def normalize_stop_airport(airport: str | None) -> str | None:
    airport_code = airport.strip().upper() if airport else None
    return airport_code or None


def get_request_stops(request: TripPlanRequest) -> list[TripStop]:
    if request.stops:
        return request.stops

    raise ValueError("At least one city stop is required.")


@router.post("/")
def plan_trip(request: TripPlanRequest):
    try:
        stops = get_request_stops(request)
        current_airport = request.origin_airport.strip().upper()
        current_date = request.outbound_date
        flights = []
        cities = []

        for index, stop in enumerate(stops):
            stop_airport = normalize_stop_airport(stop.airport)
            checkin_date = current_date
            checkout_date = checkin_date + datetime.timedelta(days=stop.days)

            if current_airport and stop_airport:
                segment_flights = fetch_flights(
                    current_airport,
                    stop_airport,
                    request.currency,
                    checkin_date.isoformat(),
                    None,
                )
                flights.extend(segment_flights)

            hotels = fetch_hotels(
                stop.city,
                checkin_date.isoformat(),
                checkout_date.isoformat(),
                request.currency,
            )

            activities = (
                fetch_activities(stop.city, stop.activity_categories)
                if request.include_activities and stop.activity_categories
                else []
            )

            weather = (
                fetch_weather(stop.city, checkin_date)
                if request.include_weather
                else None
            )

            cities.append({
                "city": stop.city,
                "airport": stop_airport,
                "days": stop.days,
                "order": index + 1,
                "checkin_date": checkin_date.isoformat(),
                "checkout_date": checkout_date.isoformat(),
                "hotels": hotels,
                "activities": activities,
                "weather": weather,
            })

            current_airport = stop_airport
            current_date = checkout_date

        if request.return_to_origin and current_airport and current_airport != request.origin_airport.strip().upper():
            return_flights = fetch_flights(
                current_airport,
                request.origin_airport.strip().upper(),
                request.currency,
                current_date.isoformat(),
                None,
            )
            flights.extend(return_flights)

        all_hotels = [
            hotel
            for city in cities
            for hotel in city["hotels"]
        ]
        all_activities = [
            activity
            for city in cities
            for activity in city["activities"]
        ]
        weather_by_city = [
            {
                "city": city["city"],
                "airport": city["airport"],
                "weather": city["weather"],
            }
            for city in cities
            if city["weather"] is not None
        ]

        trip_data = {
            "origin_airport": request.origin_airport.strip().upper(),
            "start_date": request.outbound_date.isoformat(),
            "end_date": current_date.isoformat(),
            "currency": request.currency,
            "cities": cities,
            "flights": flights,
            "hotels": all_hotels,
            "activities": all_activities,
            "weather": weather_by_city[0]["weather"] if weather_by_city else None,
            "weather_by_city": weather_by_city,
        }
        
        ai_plan = generate_trip_plan(trip_data)
        
        return {
            "trip_data": trip_data,
            "ai_plan": ai_plan
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

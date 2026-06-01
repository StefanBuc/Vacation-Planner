import os
import datetime
import re
import serpapi
import requests
from dotenv import load_dotenv
from app.schemas.flight import FlightOption
from app.schemas.hotel import HotelOption

load_dotenv()
client = serpapi.Client(api_key=os.getenv("SERPAPI_KEY"))
AIRPORT_CODE_PATTERN = re.compile(r"^[A-Za-z]{3}$")


def normalize_airport_code(value: str, field_name: str) -> str:
    normalized = value.strip().upper()

    if not AIRPORT_CODE_PATTERN.fullmatch(normalized):
        raise ValueError(
            f"{field_name} must be a 3-letter airport or metro code like YYZ, CDG, or PAR."
        )

    return normalized

def get_flights(origin:str, destination:str, currency:str, outbound_date:str, return_date:str) -> list:
    origin_code = normalize_airport_code(origin, "Origin airport")
    destination_code = normalize_airport_code(destination, "Flight destination")

    try:
        results = client.search({
            "engine": "google_flights",
            "hl": "en",
            "gl": "us",
            "departure_id": origin_code,
            "arrival_id": destination_code,
            "currency": currency,
            "outbound_date": outbound_date,
            "return_date": return_date,
        })
    except requests.HTTPError as error:
        status_code = error.response.status_code if error.response is not None else None
        if status_code == 400:
            raise ValueError(
                "Flights search needs airport or metro codes, for example YYZ to PAR or CDG."
            ) from error
        raise RuntimeError("Flights provider request failed.") from error

    flights = results.get("best_flights") or results.get("other_flights") or []

    if not flights:
        provider_error = results.get("error")
        if provider_error:
            raise LookupError(
                f"{provider_error} Try a specific airport code like CDG or ORY instead of a metro code like PAR."
            )

    return parse_flight_options(flights)

def parse_flight_options(flights):
    parsed = []

    for option in flights:
        first_leg = option["flights"][0]

        parsed.append(FlightOption(
            airline=first_leg["airline"],
            flight_number=first_leg["flight_number"],
            origin=first_leg["departure_airport"]["id"],
            destination=first_leg["arrival_airport"]["id"],
            departure_time=first_leg["departure_airport"]["time"],
            arrival_time=first_leg["arrival_airport"]["time"],
            duration_minutes=option["total_duration"],
            price=option["price"],
            type=option.get("type", "unknown")
        ))

    return parsed

def get_hotels(destination:str, checkin_date:str, checkout_date:str, currency:str) -> list:

    results = client.search({
        "engine": "google_hotels",
        "q": destination,
        "check_in_date": checkin_date,
        "check_out_date": checkout_date
    })

    properties = results.get("properties", [])
    
    return parse_hotel_options(properties, checkin_date, checkout_date)

def parse_hotel_options(hotels, checkin_date, checkout_date):
    parsed = []

    for hotel in hotels:
        gps = hotel.get("gps_coordinates", {})
        price = hotel.get("rate_per_night", {}).get("lowest", "0")

        parsed.append(HotelOption(
            name=hotel["name"],
            latitude=gps.get("latitude"),
            longitude=gps.get("longitude"),
            rating=hotel.get("overall_rating", 0),
            price_per_night=parse_price(price),
            checkin_date=checkin_date,
            checkout_date=checkout_date
        ))

    return parsed

def parse_price(price: str) -> float:
    return float(price.replace("$", "").replace(",", ""))

def get_coordinates(destination: str):
    url = "https://geocoding-api.open-meteo.com/v1/search"

    params = {
        "name": destination,
        "count": 1,
        "language": "en",
        "format": "json"
    }

    data = requests.get(url, params=params).json()
    result = data["results"][0]

    return result["latitude"], result["longitude"]

def get_weather(destination: str, date: datetime.date) -> dict:
    lat, lon = get_coordinates(destination)
    today = datetime.date.today()

    if date <= today:
        url = "https://archive-api.open-meteo.com/v1/archive"
    elif date <= today + datetime.timedelta(days=16):
        url = "https://api.open-meteo.com/v1/forecast"
    else:

        url = "https://archive-api.open-meteo.com/v1/archive"
        date = date.replace(year=today.year - 1)

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": date.isoformat(),
        "end_date": date.isoformat(),
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "auto"
    }

    data = requests.get(url, params=params).json()
    return parse_open_meteo_weather(data, date)

def parse_open_meteo_weather(data: dict, date: datetime.date) -> dict:
    daily = data.get("daily", {})

    return {
        "date_used": date.isoformat(),
        "max_temp_c": daily.get("temperature_2m_max", [None])[0],
        "min_temp_c": daily.get("temperature_2m_min", [None])[0],
        "precipitation_mm": daily.get("precipitation_sum", [None])[0],
    }
    

def get_longitude_and_latitude(destination: str) -> tuple:
    url = "https://api.geoapify.com/v1/geocode/search"
    
    params = {
        "text": destination,
        "apiKey": os.getenv("GEOAPIFY_KEY")
    }
    
    longitude, latitude = None, None
    data = requests.get(url, params=params).json()
    
    longitude = data["features"][0]["properties"]["lon"]
    latitude = data["features"][0]["properties"]["lat"]
    
    return longitude, latitude

def get_activities(destination: str, categories: list) -> list:
    longitude, latitude = get_longitude_and_latitude(destination)
    
    url = "https://api.geoapify.com/v2/places"
    
    params = {
        "categories": ",".join(categories),
        "filter": f"circle:{longitude},{latitude},5000",
        "limit": 20,
        "apiKey": os.getenv("GEOAPIFY_KEY")
    }
    
    data = requests.get(url, params=params).json()
    
    return parse_activity_options(data.get("features", []))

def parse_activity_options(activities: list) -> list:
    parsed_activities = []
    
    for activity in activities:
        properties = activity.get("properties", {})
        parsed_activities.append({
            "name": properties.get("name"),
            "description": properties.get("description"),
            "longitude": properties.get("lon"),
            "latitude": properties.get("lat"),
            "price": 0,
            "duration_minutes": 60,
            "type": properties.get("categories", [None])[0]
        })
    
    return parsed_activities
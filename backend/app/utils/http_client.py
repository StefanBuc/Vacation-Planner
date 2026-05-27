import os
import serpapi
from dotenv import load_dotenv
from app.schemas.flight import FlightOption
from app.schemas.hotel import HotelOption

load_dotenv()
client = serpapi.Client(api_key=os.getenv("SERPAPI_KEY"))

def getFlights(origin:str, destination:str, currency:str, outbound_date:str, return_date:str) -> list:
    
    results = client.search({
        "engine": "google_flights",
        "hl": "en",
        "gl": "us",
        "departure_id": origin,
        "arrival_id": destination,
        "currency": currency,
        "outbound_date": outbound_date,
        "return_date": return_date,

    })

    flights = results.get("best_flights") or results.get("other_flights") or []

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

def getHotels(destination:str, checkin_date:str, checkout_date:str, currency:str) -> list:

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
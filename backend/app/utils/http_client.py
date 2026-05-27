import os
import serpapi
from dotenv import load_dotenv
from app.schemas.flight import FlightOption

load_dotenv()

def getFlights(origin:str, destination:str, currency:str, outbound_date:str, return_date:str) -> list:
    client = serpapi.Client(api_key=os.getenv("SERPAPI_KEY"))
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

def getHotels():
    pass
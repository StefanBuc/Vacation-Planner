from ..utils.http_client import get_flights

def fetch_flights(origin: str, destination: str, currency: str, outbound_date: str, return_date: str | None = None):

    flights = get_flights(origin, destination, currency, outbound_date, return_date)

    return flights

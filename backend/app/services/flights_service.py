from ..utils.http_client import getFlights


def fetch_flights(origin:str, destination:str, currency:str, outbound_date:str, return_date:str):

    flights = getFlights(origin, destination, currency, outbound_date, return_date)

    return flights

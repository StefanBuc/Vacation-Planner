from ..utils.http_client import get_hotels

def fetch_hotels(destination:str, checkin_date:str, checkout_date:str, currency:str):

    hotels = get_hotels(destination, checkin_date, checkout_date, currency)

    return hotels
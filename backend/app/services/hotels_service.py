from ..utils.http_client import getHotels

def fetch_hotels(destination:str, checkin_date:str, checkout_date:str, currency:str):

    hotels = getHotels(destination, checkin_date, checkout_date, currency)

    return hotels
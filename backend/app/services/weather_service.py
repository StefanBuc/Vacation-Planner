from ..utils.http_client import get_weather
import datetime

def fetch_weather(destination:str, date:datetime.date) -> dict:

    weather = get_weather(destination, date)
    
    return weather
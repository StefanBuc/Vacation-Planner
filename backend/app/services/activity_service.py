from ..utils.http_client import get_activities

def fetch_activities(destination:str, categories:list):

    activities = get_activities(destination, categories)

    return activities
import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_KEY"))

def generate_trip_plan(trip_data: dict) -> str:
    prompt = f"""
    You are an AI vacation planner.

    Use ONLY the provided trip data.
    Do not invent flight prices, hotel prices, or activity names.

    Create:
    1. A short trip summary
    2. Best flight recommendation
    3. Best hotel recommendation
    4. Day-by-day itinerary
    5. Weather notes

    Trip data:
    {json.dumps(trip_data, default=str, indent=2)}
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        
    )

    return response.text or ""
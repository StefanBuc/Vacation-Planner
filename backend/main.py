import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.routes import activity, flight, hotel, weather, plan_trip

load_dotenv()

origins = os.getenv("ALLOWED_ORIGINS", "*")

if origins == "*":
    allow_origins = ["*"]
else:
    allow_origins = [origin.strip() for origin in origins.split(",")]

app = FastAPI()

app.include_router(flight.router)
app.include_router(hotel.router)
app.include_router(weather.router)
app.include_router(activity.router)
app.include_router(plan_trip.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

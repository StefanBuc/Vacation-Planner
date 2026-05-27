from app.services.flights_service import fetch_flights

print(fetch_flights("JFK", "LAX", "CAD", "2026-12-01", "2026-12-15"))


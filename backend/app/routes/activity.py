from fastapi import APIRouter, HTTPException, Query
from app.services.activity_service import fetch_activities

router = APIRouter(prefix="/activities", tags=["activities"])

@router.get("/{destination}")
def get_activities(destination: str, categories: list[str] = Query([])):
    try:
        return fetch_activities(destination, categories)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail="Activities provider request failed.")
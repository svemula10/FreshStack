# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from .database import get_db, redis_client, engine, Base
from . import models, schemas, engine as matching_engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="FreshStack API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/recipes/match/{user_id}", response_model=List[schemas.RecipeResponse])
def get_matched_recipes(
    user_id: int, 
    max_time: Optional[int] = Query(None, description="Maximum total cooking time in minutes"),
    db: Session = Depends(get_db)
):
    user_inventory_ids = set()
    cache_key = f"user_inventory:{user_id}"
    
    # Try fetching from Redis cache with graceful fallback
    try:
        cached_inventory = redis_client.smembers(cache_key)
        if cached_inventory:
            user_inventory_ids = {int(i) for i in cached_inventory}
    except Exception:
        pass

    # Fallback to SQLite if cache is empty
    if not user_inventory_ids:
        items = db.query(models.InventoryItem).filter(models.InventoryItem.user_id == user_id).all()
        user_inventory_ids = {item.ingredient_id for item in items}
        
        if user_inventory_ids:
            try:
                redis_client.sadd(cache_key, *user_inventory_ids)
            except Exception:
                pass
            
    recipes = db.query(models.Recipe).all()
    
    # Run deterministic matching with time constraints
    matched = matching_engine.match_recipes(user_inventory_ids, recipes, max_time_minutes=max_time)
    return matched

@app.post("/inventory/", response_model=schemas.InventoryCreate)
def add_inventory(item: schemas.InventoryCreate, db: Session = Depends(get_db)):
    db_item = models.InventoryItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    try:
        redis_client.sadd(f"user_inventory:{item.user_id}", item.ingredient_id)
    except Exception:
        pass
    
    return item
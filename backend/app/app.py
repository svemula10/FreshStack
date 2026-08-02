from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .database import get_db, redis_client, engine, Base
from . import models, schemas, engine as matching_engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="FreshStack API", version="1.0.0")

@app.get("/recipes/match/{user_id}", response_model=List[schemas.RecipeResponse])
def get_matched_recipes(user_id: int, db: Session = Depends(get_db)):
    # Check Redis cache for fast user inventory state lookup
    cache_key = f"user_inventory:{user_id}"
    cached_inventory = redis_client.smembers(cache_key)
    
    if cached_inventory:
        user_inventory_ids = {int(i) for i in cached_inventory}
    else:
        items = db.query(models.InventoryItem).filter(models.InventoryItem.user_id == user_id).all()
        user_inventory_ids = {item.ingredient_id for item in items}
        if user_inventory_ids:
            redis_client.sadd(cache_key, *user_inventory_ids)
            
    recipes = db.query(models.Recipe).all()
    matched = matching_engine.match_recipes(user_inventory_ids, recipes)
    return matched

@app.post("/inventory/", response_model=schemas.InventoryCreate)
def add_inventory(item: schemas.InventoryCreate, db: Session = Depends(get_db)):
    db_item = models.InventoryItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    # Invalidate / update Redis cache
    cache_key = f"user_id:{item.user_id}"
    redis_client.sadd(f"user_inventory:{item.user_id}", item.ingredient_id)
    
    return item
# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from .database import get_db, redis_client, engine, Base
from . import models, schemas, engine as matching_engine
from app import database, models, schemas

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


@app.post("/ingredients/", response_model=schemas.IngredientResponse)
def create_ingredient(ingredient: schemas.IngredientCreate, db: Session = Depends(database.get_db)):
    # Check if ingredient already exists
    existing = db.query(models.Ingredient).filter(models.Ingredient.name == ingredient.name).first()
    if existing:
        return existing
        
    db_ingredient = models.Ingredient(name=ingredient.name, category=ingredient.category)
    db.add(db_ingredient)
    db.commit()
    db.refresh(db_ingredient)
    return db_ingredient


@app.get("/inventory/{user_id}")
def get_user_inventory(user_id: int, db: Session = Depends(database.get_db)):
    # Query inventory and eagerly load the associated ingredient relationship
    items = db.query(models.Inventory).options(
        joinedload(models.Inventory.ingredient)
    ).filter(models.Inventory.user_id == user_id).all()
    
    # Map the response to include the name string explicitly
    result = []
    for item in items:
        result.append({
            "id": item.id,
            "user_id": item.user_id,
            "ingredient_id": item.ingredient_id,
            "ingredient_name": item.ingredient.name if item.ingredient else "unknown"
        })
    return result


@app.post("/inventory/", response_model=schemas.InventoryCreate)
def add_inventory(item: schemas.InventoryCreate, db: Session = Depends(get_db)):
    db_item = models.Inventory(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return item

@app.get("/recipes/match/{user_id}", response_model=List[schemas.RecipeResponse])
def get_matched_recipes(
    user_id: int, 
    max_time: Optional[int] = Query(None, description="Maximum total cooking time in minutes"),
    db: Session = Depends(get_db)
):
    items = db.query(models.Inventory).filter(models.Inventory.user_id == user_id).all()
    user_inventory_ids = {item.ingredient_id for item in items}
    
    recipes = db.query(models.Recipe).all()
    matched = matching_engine.match_recipes(user_inventory_ids, recipes, max_time_minutes=max_time)
    return matched


@app.delete("/inventory/{inventory_id}")
def delete_inventory_item(inventory_id: int, db: Session = Depends(database.get_db)):
    item = db.query(models.Inventory).filter(models.Inventory.id == inventory_id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"message": "Item deleted"}
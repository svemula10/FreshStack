# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from .database import get_db, redis_client, engine, Base
from . import models, schemas
import re

Base.metadata.create_all(bind=engine)

app = FastAPI(title="FreshStack API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/recipes/match/{user_id}")
def get_matched_recipes(
    user_id: int, 
    max_time: Optional[int] = Query(None, description="Maximum total cooking time in minutes"),
    db: Session = Depends(get_db)
):
    # 1. Fetch user's inventory item names and build token set
    user_inventory = db.query(models.Inventory).filter(models.Inventory.user_id == user_id).all()
    user_pantry_tokens = set()
    for item in user_inventory:
        name = item.ingredient.name if hasattr(item, 'ingredient') and item.ingredient else f"item-{item.ingredient_id}"
        for word in name.lower().split():
            user_pantry_tokens.add(word)
            if word.endswith('s') and len(word) > 3:
                user_pantry_tokens.add(word[:-1])

    # 2. Fetch all recipes from database
    all_recipes = db.query(models.Recipe).all()
    matched_recipes = []

    for recipe in all_recipes:
        recipe_ingredients = recipe.ingredients if hasattr(recipe, 'ingredients') else []
        if not recipe_ingredients:
            continue

        missing_count = 0
        ingredient_list = []

        for ing in recipe_ingredients:
            # Safely extract text from the SQLAlchemy relationship
            ing_text = ""
            if hasattr(ing, 'name') and ing.name:
                ing_text = ing.name.strip()
            elif hasattr(ing, 'ingredient') and ing.ingredient and hasattr(ing.ingredient, 'name'):
                ing_text = ing.ingredient.name.strip()
            else:
                ing_text = str(ing).strip()
            
            # Programmatically filter out layout artifacts, blank spaces, or pure symbols
            if not ing_text or ing_text in ["•", "-", "*"] or not re.search(r'[a-zA-Z0-9]', ing_text):
                continue
            
            # Clean leading/trailing stray bullet characters
            cleaned_text = re.sub(r'^[•\-\*\s]+|[•\-\*\s]+$', '', ing_text).strip()
            if cleaned_text and cleaned_text not in ingredient_list:
                ingredient_list.append(cleaned_text)

            # Match checking logic
            ing_lower = cleaned_text.lower()
            has_match = any(token in ing_lower for token in user_pantry_tokens if len(token) > 2)
            is_pantry_staple = any(staple in ing_lower for staple in ['sugar', 'salt', 'water', 'puff pastry', 'ice cream', 'whipped cream', 'flour'])
            is_optional = 'optional' in ing_lower

            if not has_match and not is_optional and not is_pantry_staple:
                missing_count += 1

        # Lenient threshold: allow recipes missing up to 3 non-staple ingredients
        MAX_MISSING_ALLOWED = 3
        if missing_count <= MAX_MISSING_ALLOWED:
            matched_recipes.append({
                "id": recipe.id,
                "title": recipe.title,
                "instructions": recipe.instructions,
                "prep_time": recipe.prep_time,
                "cook_time": recipe.cook_time,
                "servings": recipe.servings,
                "rating": recipe.rating,
                "url": recipe.url,
                "missing_ingredient_count": missing_count,
                "ingredients": ingredient_list
            })

    return matched_recipes


@app.post("/ingredients/", response_model=schemas.IngredientResponse)
def create_ingredient(ingredient: schemas.IngredientCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Ingredient).filter(models.Ingredient.name == ingredient.name).first()
    if existing:
        return existing
        
    db_ingredient = models.Ingredient(name=ingredient.name, category=ingredient.category)
    db.add(db_ingredient)
    db.commit()
    db.refresh(db_ingredient)
    return db_ingredient


@app.get("/inventory/{user_id}")
def get_user_inventory(user_id: int, db: Session = Depends(get_db)):
    items = db.query(models.Inventory).options(
        joinedload(models.Inventory.ingredient)
    ).filter(models.Inventory.user_id == user_id).all()
    
    result = []
    for item in items:
        result.append({
            "id": item.id,
            "user_id": item.user_id,
            "ingredient_id": item.ingredient_id,
            "ingredient_name": item.ingredient.name if item.ingredient else "unknown",
            "zone": getattr(item, "zone", "cabinet")
        })
    return result


@app.post("/inventory/")
def add_inventory(item: schemas.InventoryCreate, db: Session = Depends(get_db)):
    db_item = models.Inventory(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    try:
        redis_client.sadd(f"user_inventory:{item.user_id}", item.ingredient_id)
    except Exception:
        pass
    
    return db_item


@app.put("/inventory/{inventory_id}/zone")
def update_inventory_zone(inventory_id: int, zone_data: schemas.InventoryUpdateZone, db: Session = Depends(get_db)):
    item = db.query(models.Inventory).filter(models.Inventory.id == inventory_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    item.zone = zone_data.zone
    db.commit()
    db.refresh(item)
    return {"message": "Zone updated successfully", "zone": item.zone}


@app.delete("/inventory/{inventory_id}")
def delete_inventory_item(inventory_id: int, db: Session = Depends(get_db)):
    item = db.query(models.Inventory).filter(models.Inventory.id == inventory_id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"message": "Item deleted"}
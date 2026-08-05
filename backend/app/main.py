# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.engine import parse_time_to_minutes
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

def parse_time_to_minutes(time_str: Optional[str]) -> int:
    if not time_str:
        return 0
    
    time_str = str(time_str).lower().strip()
    total_minutes = 0
    
    # Check for hours (e.g., "1 hr", "1 hours", "1.5 hr")
    hour_match = re.search(r'([\d\.]+)\s*(?:hr|hour|h)', time_str)
    if hour_match:
        try:
            total_minutes += float(hour_match.group(1)) * 60
        except ValueError:
            pass
            
    # Check for minutes (e.g., "30 mins", "30 minutes", "30 m")
    min_match = re.search(r'([\d\.]+)\s*(?:min|m)', time_str)
    if min_match:
        try:
            total_minutes += float(min_match.group(1))
        except ValueError:
            pass
            
    # Fallback: If no explicit unit words were found, but it has digits, check if it's a raw number
    if total_minutes == 0:
        # If the string contains a colon like "1:30"
        if ":" in time_str:
            parts = time_str.split(":")
            try:
                total_minutes = int(parts[0]) * 60 + int(parts[1])
            except ValueError:
                pass
        else:
            num_match = re.search(r'([\d\.]+)', time_str)
            if num_match:
                try:
                    # If it's a standalone number under 10, assume hours if no mins word exists, 
                    # otherwise treat as minutes. Safest default for raw integers in recipe DBs is minutes:
                    val = float(num_match.group(1))
                    total_minutes += val
                except ValueError:
                    pass
                
    return int(total_minutes)

@app.get("/recipes/match/{user_id}")
def get_matched_recipes(
    user_id: int, 
    max_hours: Optional[int] = Query(0, description="Maximum cooking hours"),
    max_mins: Optional[int] = Query(0, description="Maximum cooking minutes"),
    limit: int = Query(10, description="Number of recipes to return initially"),
    offset: int = Query(0, description="Offset for pagination"),
    db: Session = Depends(get_db)
):
    # Compute total allowed minutes from side-by-side inputs
    total_max_minutes = (max_hours or 0) * 60 + (max_mins or 0)
    effective_max_time = total_max_minutes if total_max_minutes > 0 else None

    # 1. Fetch user's inventory
    user_inventory = db.query(models.Inventory).options(
        joinedload(models.Inventory.ingredient)
    ).filter(models.Inventory.user_id == user_id).all()
    
    user_tokens = set()
    for item in user_inventory:
        name = item.ingredient.name if item.ingredient and item.ingredient.name else f"item-{item.ingredient_id}"
        for word in name.lower().split():
            clean_word = word.strip(".,()'-")
            if len(clean_word) > 2:
                user_tokens.add(clean_word)
                if clean_word.endswith('s') and len(clean_word) > 3:
                    user_tokens.add(clean_word[:-1])

    if not user_inventory:
        return []

    # 2. Fetch all recipes
    all_recipes = db.query(models.Recipe).all()
    unique_matched_recipes_dict = {}

    for recipe in all_recipes:
        if not recipe.title:
            continue
            
        normalized_title = recipe.title.strip().lower()
        if normalized_title in unique_matched_recipes_dict:
            continue

        # --- RIGID TIME CONSTRAINT FILTER ---
        if effective_max_time is not None:
            prep_mins = parse_time_to_minutes(recipe.prep_time)
            cook_mins = parse_time_to_minutes(recipe.cook_time)
            total_recipe_time = prep_mins + cook_mins
            
            # If a recipe has a calculable total time and it exceeds the user's limit, drop it!
            if total_recipe_time > 0 and total_recipe_time > effective_max_time:
                continue

        raw_ingredients = recipe.ingredients if hasattr(recipe, 'ingredients') else []
        if not raw_ingredients:
            continue

        ingredient_list = []
        for ing in raw_ingredients:
            ing_text = ""
            if hasattr(ing, 'name') and ing.name:
                ing_text = ing.name.strip()
            elif hasattr(ing, 'ingredient') and ing.ingredient and hasattr(ing.ingredient, 'name'):
                ing_text = ing.ingredient.name.strip()
            else:
                ing_text = str(ing).strip()

            lines = re.split(r'\n+|•', ing_text)
            for line in lines:
                cleaned_line = line.strip()
                if not cleaned_line or cleaned_line in ["•", "-", "*"] or len(cleaned_line) <= 1:
                    continue
                if cleaned_line.lower() in ["chef john", "allrecipes", "recipe courtesy of", "submitted by", "copyright", "photo by"]:
                    continue
                
                final_ing = re.sub(r'^[•\-\*\s]+|[•\-\*\s]+$', '', cleaned_line).strip()
                if final_ing and final_ing not in ingredient_list:
                    ingredient_list.append(final_ing)

        # --- PRECISE MATCH & MISSING COUNT COMPUTATION ---
        implied_staples = {
            'salt', 'pepper', 'water', 'oil', 'olive oil', 'butter', 'sugar', 
            'garlic powder', 'onion powder', 'oregano', 'basil', 'flour', 'milk', 'vanilla', 'black pepper'
        }

        matched_count = 0
        missing_count = 0

        for ing_str in ingredient_list:
            lower_str = ing_str.lower()
            is_staple = any(staple in lower_str for staple in implied_staples) or 'optional' in lower_str
            if is_staple:
                continue

            # Check if any user token matches this ingredient line
            has_match = any(token in lower_str for token in user_tokens if len(token) > 2)

            if has_match:
                matched_count += 1
            else:
                missing_count += 1

        raw_instructions = recipe.instructions or ""
        cleaned_instructions = re.sub(r'(?:Photo by|Recipe courtesy of|Submitted by|Copyright).*', '', raw_instructions, flags=re.IGNORECASE)
        
        instruction_lines = cleaned_instructions.split('\n')
        filtered_instructions = [l.strip() for l in instruction_lines if l.strip() and len(l.strip()) > 2]
        
        if filtered_instructions:
            last_line = filtered_instructions[-1]
            if len(last_line) < 20 and not any(p in last_line for p in ['.', '!', '?', ',']) and not any(v in last_line.lower() for v in ['preheat', 'cook', 'bake', 'mix', 'serve', 'add', 'heat', 'stir']):
                filtered_instructions.pop()

        final_instructions_block = "\n".join(filtered_instructions)

        # Qualification Rule: Any recipe where the user owns at least 1 matching ingredient qualifies
        if matched_count > 0 and ingredient_list:
            unique_matched_recipes_dict[normalized_title] = {
                "id": recipe.id,
                "title": recipe.title,
                "instructions": final_instructions_block,
                "prep_time": recipe.prep_time,
                "cook_time": recipe.cook_time,
                "servings": recipe.servings,
                "rating": recipe.rating,
                "url": recipe.url,
                "missing_ingredient_count": missing_count,
                "matched_count": matched_count,
                "ingredients": ingredient_list
            }

    # --- ABSOLUTE MATCHED DENSITY SORTING ---
    # 1. -r["matched_count"]: Recipes with the HIGHEST number of matches come FIRST.
    # 2. r["missing_ingredient_count"]: Fewest missing items next.
    sorted_recipes = sorted(
        unique_matched_recipes_dict.values(),
        key=lambda r: (
            r["missing_ingredient_count"], 
            -r["matched_count"],
            -float(r["rating"]) if r.get("rating") and str(r["rating"]).replace('.', '', 1).isdigit() else 0.0
        )
    )

    paginated_recipes = sorted_recipes[offset : offset + limit]
    return paginated_recipes


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
        assigned_zone = getattr(item, "zone", None)
        if not assigned_zone and item.ingredient and hasattr(item.ingredient, "category") and item.ingredient.category:
            assigned_zone = item.ingredient.category
        if not assigned_zone:
            assigned_zone = "cabinet"

        result.append({
            "id": item.id,
            "user_id": item.user_id,
            "ingredient_id": item.ingredient_id,
            "ingredient_name": item.ingredient.name if item.ingredient else "unknown",
            "zone": assigned_zone
        })
    return result


@app.post("/inventory/")
def add_inventory(item: schemas.InventoryCreate, db: Session = Depends(get_db)):
    db_item = models.Inventory(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
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
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

        # --- CORE MATCHING ENGINE ---
        implied_staples = {
            'salt', 'pepper', 'water', 'oil', 'olive oil', 'butter', 'sugar', 
            'garlic powder', 'onion powder', 'oregano', 'basil', 'flour', 'milk', 'vanilla', 'black pepper'
        }

        matched_core_items = 0
        missing_count = 0

        for ing_str in ingredient_list:
            lower_str = ing_str.lower()
            
            # Check if staple
            is_staple = any(staple in lower_str for staple in implied_staples) or 'optional' in lower_str
            if is_staple:
                continue

            # Substring token match against user inventory (e.g. user has "chicken" -> matches "3 skinless, boneless chicken breast halves")
            has_match = any(token in lower_str for token in user_tokens if len(token) > 2)

            if has_match:
                matched_core_items += 1
            else:
                missing_count += 1

        raw_instructions = recipe.instructions or ""
        
        # Remove common boilerplate trailers first
        cleaned_instructions = re.sub(r'(?:Photo by|Recipe courtesy of|Submitted by|Copyright).*', '', raw_instructions, flags=re.IGNORECASE)
        
        instruction_lines = cleaned_instructions.split('\n')
        filtered_instructions = []
        
        for line in instruction_lines:
            line_str = line.strip()
            line_lower = line_str.lower()
            
            if not line_str:
                continue
                
            # Filter out lines that are purely photo credits, URLs, or generic metadata
            if "photo by" in line_lower or line_lower.startswith(("photo", "http", "www.")):
                continue
                
            filtered_instructions.append(line_str)

        # Drop trailing author sign-offs or contributor handles (e.g., "lc206", "Chef John", "Amanda")
        # If the very last line is short (under 15 characters) and contains NO sentence-ending punctuation like '.', '!', or '?' 
        # and has no action verbs, it is a username/author tag and must be chopped off!
        if filtered_instructions:
            last_line = filtered_instructions[-1]
            is_likely_username = (
                len(last_line) < 15 and 
                not any(punct in last_line for punct in ['.', '!', '?', ',']) and 
                not any(verb in last_line.lower() for verb in ['preheat', 'rub', 'stuff', 'place', 'roast', 'whisk', 'remove', 'pour', 'transfer', 'tent', 'cut', 'spoon', 'garnish', 'serve', 'cook', 'mix', 'heat'])
            )
            if is_likely_username:
                filtered_instructions.pop()

        final_instructions_block = "\n".join(filtered_instructions)

        MAX_MISSING_ALLOWED = 3

        # If user has at least one matching core ingredient (like chicken), show the recipe!
        if matched_core_items > 0 and missing_count <= MAX_MISSING_ALLOWED and ingredient_list:
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
                "matched_core_items": matched_core_items,
                "ingredients": ingredient_list
            }

    sorted_recipes = sorted(
        unique_matched_recipes_dict.values(),
        key=lambda r: (
            -r["matched_core_items"],
            r["missing_ingredient_count"], 
            -float(r["rating"]) if r.get("rating") and str(r["rating"]).replace('.', '', 1).isdigit() else 0.0
        )
    )

    return sorted_recipes


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
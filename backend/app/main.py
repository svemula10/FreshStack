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
    # 1. Fetch user's inventory item names and build strict token set
    user_inventory = db.query(models.Inventory).filter(models.Inventory.user_id == user_id).all()
    user_pantry_tokens = set()
    for item in user_inventory:
        name = item.ingredient.name if hasattr(item, 'ingredient') and item.ingredient else f"item-{item.ingredient_id}"
        for word in name.lower().split():
            clean_word = word.strip(".,()'-")
            if len(clean_word) > 2:
                user_pantry_tokens.add(clean_word)
                if clean_word.endswith('s') and len(clean_word) > 3:
                    user_pantry_tokens.add(clean_word[:-1])

    if not user_inventory:
        return []

    # 2. Fetch all recipes from database
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
        matched_pantry_count = 0

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
                cleaned_lower = cleaned_line.lower()

                if not cleaned_line or cleaned_line in ["•", "-", "*"] or len(cleaned_line) <= 1:
                    continue

                modifier_keywords = [
                    "or more to taste", "or as needed", "to taste", "optional", "thawed",
                    "juiced", "peeled", "cored", "chopped", "sliced", "halved", "seeded", 
                    "crushed", "minced", "diced", "grated", "chilled", "cold", "warm", 
                    "melted", "softened", "cubed", "and cubed", "peeled and chopped"
                ]

                is_modifier_line = cleaned_lower.startswith(tuple(modifier_keywords)) or cleaned_line in ["Juiced", "Peeled", "Cored", "Chopped", "Sliced", "Cubed", "Seeded", "Chilled", "Cold", "Melted", "Softened", "Thawed"]

                if is_modifier_line and ingredient_list:
                    ingredient_list[-1] = f"{ingredient_list[-1]} ({cleaned_line})"
                    continue

                if cleaned_lower.endswith("x") or cleaned_lower.endswith(":") or cleaned_lower in ["ingredients", "filling:", "sauce:", "garnish:"]:
                    continue

                final_ing = re.sub(r'^[•\-\*\s]+|[•\-\*\s]+$', '', cleaned_line).strip()
                if final_ing and final_ing not in ingredient_list:
                    ingredient_list.append(final_ing)

        # --- PRECISE INGREDIENT MATCHING & COUNTING ---
        missing_count = 0
        for ing_str in ingredient_list:
            lower_str = ing_str.lower()
            
            # An ingredient matches if a significant word in the ingredient name 
            # (e.g., "watermelon", "pepper", "salt") is present in the user's pantry tokens.
            # We ignore common measurements/descriptors like "cups", "tablespoons", "fresh", "chopped".
            ignore_words = {"cup", "cups", "tablespoon", "tablespoons", "teaspoon", "teaspoons", "fresh", "chopped", "sliced", "diced", "minced", "whole", "large", "small", "medium", "oz", "pound", "pounds", "clove", "cloves", "pinch", "dash"}
            
            ing_words = [w.strip(".,()'-") for w in lower_str.split() if w.strip(".,()'-") not in ignore_words and len(w.strip(".,()'-")) > 2]
            
            # Check if any core word of this ingredient exists in user inventory tokens
            has_match = any(word in user_pantry_tokens for word in ing_words)
            
            # Only true physical non-food environment elements like water are freebies.
            is_culinary_element = 'water' in lower_str and 'watermelon' not in lower_str

            if has_match:
                matched_pantry_count += 1
            elif not is_culinary_element and 'optional' not in lower_str:
                missing_count += 1

        # Instructions cleanup
        raw_instructions = recipe.instructions or ""
        cleaned_instructions = re.sub(r'(?:Photo by|Recipe courtesy of|Submitted by|Copyright).*', '', raw_instructions, flags=re.IGNORECASE)
        
        instruction_lines = cleaned_instructions.split('\n')
        filtered_instructions = []
        for line in instruction_lines:
            line_str = line.strip()
            line_lower = line_str.lower()
            if (not line_str or "photo by" in line_lower or line_lower.startswith("photo") or len(line_str) < 3):
                continue
            filtered_instructions.append(line_str)

        final_instructions_block = "\n".join(filtered_instructions)

        # Allow recipes missing up to 2 ingredients to show up, provided user owns at least one relevant item
        MAX_MISSING_ALLOWED = 2

        if matched_pantry_count > 0 and missing_count <= MAX_MISSING_ALLOWED and ingredient_list:
            unique_matched_recipes_dict[normalized_title] = {
                "id": recipe.id,
                "title": recipe.title,
                "instructions": final_instructions_block,
                "prep_time": recipe.prep_time,
                "cook_time": recipe.cook_time,
                "servings": recipe.servings,
                "rating": recipe.rating,
                "url": recipe.url,
                "missing_ingredient_count": missing_count,  # Now strictly accurate based on word intersection
                "matched_pantry_count": matched_pantry_count,
                "ingredients": ingredient_list
            }

    sorted_recipes = sorted(
        unique_matched_recipes_dict.values(),
        key=lambda r: (
            r["missing_ingredient_count"], 
            -r["matched_pantry_count"], 
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
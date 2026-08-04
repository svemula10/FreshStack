# backend/import_csv.py
import csv
import re
from app.database import SessionLocal, engine
from app.models import Base, Ingredient, Recipe, RecipeIngredient

def clean_directions(raw_text: str) -> str:
    if not raw_text:
        return ""
    
    # 1. Split text into lines
    lines = raw_text.splitlines()
    cleaned_lines = []
    
    for i, line in enumerate(lines):
        line_str = line.strip()
        # Filter out standalone author names or short noise strings at the very beginning 
        # (e.g., single-word lines that look like names, less than 15 characters, no verbs or punctuation)
        if i < 3 and len(line_str) < 15 and not any(char in line_str for char in ['.', ',', '!', '?', ' ']) and not line_str.lower().startswith(('step', 'preheat', 'mix', 'combine', 'roast', 'heat')):
            # Skip likely stray author names like "Amanda"
            continue
        if line_str:
            cleaned_lines.append(line_str)
            
    # Join back together cleanly
    result = "\n".join(cleaned_lines)
    
    # Also remove common trailing boilerplate if present
    result = re.sub(r'(?:Recipe courtesy of|Submitted by|Copyright).*', '', result, flags=re.IGNORECASE).strip()
    return result

def import_csv_data(file_path="recipes.csv"):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    print(f"Opening {file_path} and importing recipes...")
    
    ingredient_cache = {}

    def get_or_create_ingredient(name: str):
        clean_name = name.strip().title()
        if not clean_name or len(clean_name) > 100:
            return None
        if clean_name in ingredient_cache:
            return ingredient_cache[clean_name]
        
        ing = db.query(Ingredient).filter(Ingredient.name.ilike(clean_name)).first()
        if not ing:
            ing = Ingredient(name=clean_name, category="Pantry", shelf_life_days=30, allergens="None")
            db.add(ing)
            db.commit()
            db.refresh(ing)
        
        ingredient_cache[clean_name] = ing
        return ing

    with open(file_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        count = 0
        
        for row in reader:
            if count >= 500:  # Import the first 500 recipes for fast MVP testing
                break

            title = row.get("recipe_name")
            directions_raw = row.get("directions")
            ingredients_raw = row.get("ingredients")
            prep_time = row.get("prep_time")
            cook_time = row.get("cook_time")
            servings = row.get("servings")
            rating = row.get("rating")

            if not title or not ingredients_raw:
                continue

            # Clean the directions using our new sanitizer
            final_directions = clean_directions(directions_raw)

            ingredients_list = [ing.strip() for ing in ingredients_raw.split(",") if ing.strip()]

            recipe = Recipe(
                title=title, 
                instructions=final_directions[:2000] if final_directions else "",
                prep_time=prep_time,
                cook_time=cook_time,
                servings=servings,
                rating=rating,
                url=row.get("url")  # <-- Capture URL from dataset
            )
            db.add(recipe)
            db.commit()
            db.refresh(recipe)

            for ing_str in ingredients_list:
                ing_obj = get_or_create_ingredient(ing_str[:50])
                if ing_obj:
                    link = RecipeIngredient(
                        recipe_id=recipe.id, 
                        ingredient_id=ing_obj.id, 
                        quantity=1.0
                    )
                    db.add(link)
            
            db.commit()
            count += 1

    print(f"Successfully imported {count} real recipes into freshstack.db!")
    db.close()

if __name__ == "__main__":
    import_csv_data()
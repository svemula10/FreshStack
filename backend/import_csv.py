# backend/import_csv.py
import csv
import re
from app.database import SessionLocal, engine
from app.models import Base, Ingredient, Recipe, RecipeIngredient

def clean_directions(raw_text: str) -> str:
    if not raw_text:
        return ""
    lines = raw_text.splitlines()
    cleaned_lines = []
    for line in lines:
        line_str = line.strip()
        if not line_str or "photo by" in line_str.lower() or line_str.lower().startswith(("http", "www.")):
            continue
        cleaned_lines.append(line_str)
        
    if cleaned_lines:
        last_line = cleaned_lines[-1]
        if len(last_line) < 20 and not any(p in last_line for p in ['.', '!', '?', ',']) and not any(v in last_line.lower() for v in ['preheat', 'cook', 'bake', 'mix', 'serve', 'add', 'heat', 'stir']):
            cleaned_lines.pop()
            
    return "\n".join(cleaned_lines)

def parse_ingredients(ingredients_raw: str):
    if not ingredients_raw:
        return []
    
    if "\n" in ingredients_raw or "•" in ingredients_raw:
        raw_parts = re.split(r'\n+|•', ingredients_raw)
    else:
        parts = ingredients_raw.split(",")
        raw_parts = []
        buffer = ""
        for part in parts:
            p_trimmed = part.strip()
            starts_with_qty = bool(re.match(r'^(\d+|[½¼¾⅓⅔⅛⅜⅝⅞])', p_trimmed))
            if starts_with_qty or not buffer:
                if buffer:
                    raw_parts.append(buffer)
                buffer = p_trimmed
            else:
                buffer += f", {p_trimmed}"
        if buffer:
            raw_parts.append(buffer)
            
    final_list = []
    author_blocklist = ["chef john", "allrecipes", "thebritishbaker", "lc206", "cookin'mama", "cookin mama"]
    for part in raw_parts:
        cleaned = part.strip()
        if not cleaned or cleaned.lower() in author_blocklist:
            continue
        if cleaned not in final_list:
            final_list.append(cleaned)
    return final_list

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
            if count >= 500:
                break
            title = row.get("recipe_name")
            if not title or not row.get("ingredients"):
                continue

            recipe = Recipe(
                title=title, 
                instructions=clean_directions(row.get("directions"))[:2000],
                prep_time=row.get("prep_time"),
                cook_time=row.get("cook_time"),
                servings=row.get("servings"),
                rating=row.get("rating"),
                url=row.get("url")
            )
            db.add(recipe)
            db.commit()
            db.refresh(recipe)

            for ing_str in parse_ingredients(row.get("ingredients")):
                ing_obj = get_or_create_ingredient(ing_str[:100])
                if ing_obj:
                    db.add(RecipeIngredient(recipe_id=recipe.id, ingredient_id=ing_obj.id, quantity=1.0))
            db.commit()
            count += 1

    print(f"Successfully imported {count} clean recipes!")
    db.close()

if __name__ == "__main__":
    import_csv_data()
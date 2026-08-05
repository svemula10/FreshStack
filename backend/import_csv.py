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
    
    for i, line in enumerate(lines):
        line_str = line.strip()
        line_lower = line_str.lower()
        
        # Skip empty lines, photo credits, or obvious metadata
        if not line_str or "photo by" in line_lower or line_lower.startswith(("http", "www.")):
            continue
            
        cleaned_lines.append(line_str)
        
    # Check if the last line is a stray author/username signature (e.g., "TheBritishBaker", "lc206", "Chef John")
    if cleaned_lines:
        last_line = cleaned_lines[-1]
        last_lower = last_line.lower()
        is_author_tag = (
            len(last_line) < 20 and
            not any(punct in last_line for punct in ['.', '!', '?', ',']) and
            not any(verb in last_lower for verb in ['preheat', 'melt', 'add', 'reduce', 'simmer', 'stir', 'transfer', 'serve', 'cook', 'mix', 'heat', 'bake', 'blend']) and
            not any(char.isdigit() for char in last_line)
        )
        if is_author_tag:
            cleaned_lines.pop()

    result = "\n".join(cleaned_lines)
    result = re.sub(r'(?:Recipe courtesy of|Submitted by|Copyright).*', '', result, flags=re.IGNORECASE).strip()
    return result

def parse_ingredients(ingredients_raw: str):
    if not ingredients_raw:
        return []
    
    # If the database block has newlines or bullet points, split by those first
    if "\n" in ingredients_raw or "•" in ingredients_raw:
        raw_parts = re.split(r'\n+|•', ingredients_raw)
    else:
        # Standard Allrecipes CSVs separate independent items with commas.
        # But we must avoid splitting descriptive modifiers like "1 Carrot, Diced".
        # A true new ingredient in a comma list usually starts with a number or fraction.
        parts = ingredients_raw.split(",")
        raw_parts = []
        buffer = ""
        
        for part in parts:
            p_trimmed = part.strip()
            # Regex to check if fragment starts with a number or fraction (e.g., "1", "½", "4")
            starts_with_qty = bool(re.match(r'^(\d+|[½¼¾⅓⅔⅛⅜⅝⅞])', p_trimmed))
            
            if starts_with_qty or not buffer:
                if buffer:
                    raw_parts.append(buffer)
                buffer = p_trimmed
            else:
                # It's a modifier belonging to the previous item (e.g., "Diced" for Carrot)
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
            directions_raw = row.get("directions")
            ingredients_raw = row.get("ingredients")
            prep_time = row.get("prep_time")
            cook_time = row.get("cook_time")
            servings = row.get("servings")
            rating = row.get("rating")

            if not title or not ingredients_raw:
                continue

            final_directions = clean_directions(directions_raw)
            ingredients_list = parse_ingredients(ingredients_raw)

            recipe = Recipe(
                title=title, 
                instructions=final_directions[:2000] if final_directions else "",
                prep_time=prep_time,
                cook_time=cook_time,
                servings=servings,
                rating=rating,
                url=row.get("url")
            )
            db.add(recipe)
            db.commit()
            db.refresh(recipe)

            for ing_str in ingredients_list:
                ing_obj = get_or_create_ingredient(ing_str[:100])
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
# backend/import_csv.py
import csv
from app.database import SessionLocal, engine
from app.models import Base, Ingredient, Recipe, RecipeIngredient

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

            ingredients_list = [ing.strip() for ing in ingredients_raw.split(",") if ing.strip()]

            recipe = Recipe(
                title=title, 
                instructions=directions_raw[:2000] if directions_raw else "",
                prep_time=prep_time,
                cook_time=cook_time,
                servings=servings,
                rating=rating
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
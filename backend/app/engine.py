# backend/app/engine.py

def parse_time_to_minutes(time_str: str) -> int:
    """Helper to convert strings like '30 mins', '1 hrs' into total integer minutes."""
    if not time_str:
        return 999  
    
    total_minutes = 0
    time_str = time_str.lower()
    
    try:
        parts = time_str.split()
        for i, part in enumerate(parts):
            if 'hr' in part:
                total_minutes += int(parts[i - 1]) * 60
            elif 'min' in part:
                total_minutes += int(parts[i - 1])
    except Exception:
        pass
        
    return total_minutes if total_minutes > 0 else 999

def match_recipes(user_inventory_ids: set, recipes: list, max_time_minutes: int = None):
    """
    Deterministic constraint-matching engine using Python set theory.
    Filters recipes by available inventory and optional maximum total prep/cook time.
    """
    matched_results = []

    for recipe in recipes:
        # Extract ingredient links or IDs
        recipe_ingredient_ids = {link.ingredient_id for link in recipe.ingredients}
        
        if not recipe_ingredient_ids:
            continue

        available_match = recipe_ingredient_ids.intersection(user_inventory_ids)
        missing_items = recipe_ingredient_ids.difference(user_inventory_ids)
        
        # Hard constraint check: compute total time
        prep_mins = parse_time_to_minutes(recipe.prep_time)
        cook_mins = parse_time_to_minutes(recipe.cook_time)
        total_recipe_time = prep_mins + (0 if cook_mins == 999 else cook_mins)
        
        if max_time_minutes and total_recipe_time > max_time_minutes:
            continue  

        match_score = len(available_match) / len(recipe_ingredient_ids)
        
        # Format the ingredients list so Pydantic validation passes successfully
        formatted_ingredients = [
            {
                "id": link.ingredient.id,
                "name": link.ingredient.name,
                "quantity": link.quantity
            } for link in recipe.ingredients if link.ingredient
        ]

        matched_results.append({
            "id": recipe.id,
            "title": recipe.title,
            "instructions": recipe.instructions,
            "prep_time": recipe.prep_time,
            "cook_time": recipe.cook_time,
            "servings": recipe.servings,
            "rating": recipe.rating,
            "match_score": match_score,
            "missing_ingredient_count": len(missing_items),
            "ingredients": formatted_ingredients  # <-- Added missing required field
        })

    matched_results.sort(key=lambda x: x["match_score"], reverse=True)
    return matched_results
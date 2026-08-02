def match_recipes(user_inventory_ids: set[int], recipes: list) -> list:
    """
    Deterministic constraint-matching engine using Python set theory.
    Filters recipes where user inventory satisfies ingredients.
    """
    matched = []
    for recipe in recipes:
        recipe_ing_ids = {ing.id for ing in recipe.ingredients}
        # Check if user has all or a subset of required ingredients
        if recipe_ing_ids.issubset(user_inventory_ids):
            matched.append(recipe)
    return matched
from app.engine import match_recipes

class MockIngredient:
    def __init__(self, id: int, name: str):
        self.id = id
        self.name = name

class MockRecipe:
    def __init__(self, id: int, title: str, ingredients: list):
        self.id = id
        self.title = title
        self.ingredients = ingredients

def test_match_recipes_success():
    recipe = MockRecipe(id=1, title="Pasta", ingredients=[
        MockIngredient(1, "Tomato"),
        MockIngredient(2, "Noodles")
    ])
    user_inventory_ids = {1, 2, 3}
    
    matched = match_recipes(user_inventory_ids, [recipe])
    assert len(matched) == 1
    assert matched[0].title == "Pasta"

def test_match_recipes_missing_ingredient():
    recipe = MockRecipe(id=2, title="Cheesy Pasta", ingredients=[
        MockIngredient(1, "Tomato"),
        MockIngredient(4, "Cheese")
    ])
    user_inventory_ids = {1, 2}
    
    matched = match_recipes(user_inventory_ids, [recipe])
    assert len(matched) == 0
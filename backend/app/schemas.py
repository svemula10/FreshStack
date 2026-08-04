# backend/app/schemas.py
from pydantic import BaseModel
from typing import List, Optional

class IngredientResponse(BaseModel):
    id: int
    name: str
    quantity: float

    class Config:
        from_attributes = True

class RecipeResponse(BaseModel):
    id: int
    title: str
    instructions: str
    prep_time: Optional[str] = None
    cook_time: Optional[str] = None
    servings: Optional[str] = None
    rating: Optional[str] = None
    url: Optional[str] = None
    match_score: float
    missing_ingredient_count: int
    ingredients: List[IngredientResponse]

    class Config:
        from_attributes = True

# Add this schema required by your post endpoint in main.py
class InventoryCreate(BaseModel):
    user_id: int
    ingredient_id: int
    quantity: float = 1.0
    unit: str = "units"

    class Config:
        from_attributes = True
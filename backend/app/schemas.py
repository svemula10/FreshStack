from pydantic import BaseModel
from typing import List, Optional

class IngredientResponse(BaseModel):
    id: int
    name: str
    category: Optional[str] = None

    class Config:
        from_attributes = True

class InventoryItemResponse(BaseModel):
    id: int
    user_id: int
    ingredient_id: int
    quantity: float
    unit: str
    ingredient: Optional[IngredientResponse] = None

    class Config:
        from_attributes = True

class IngredientCreate(BaseModel):
    name: str
    category: Optional[str] = "cabinet"

class InventoryCreate(BaseModel):
    user_id: int
    ingredient_id: int

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


class InventoryUpdateZone(BaseModel):
    zone: str
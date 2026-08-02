from pydantic import BaseModel
from typing import List, Optional

class IngredientBase(BaseModel):
    name: str

class IngredientResponse(IngredientBase):
    id: int
    class Config:
        from_attributes = True

class RecipeResponse(BaseModel):
    id: int
    title: str
    ingredients: List[IngredientResponse]
    class Config:
        from_attributes = True

class InventoryCreate(BaseModel):
    user_id: int
    ingredient_id: int
    quantity: float
    expiration_date: Optional[str] = None
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    instructions = Column(Text)
    prep_time = Column(String, nullable=True)
    cook_time = Column(String, nullable=True)
    servings = Column(String, nullable=True)
    rating = Column(String, nullable=True)

    ingredients = relationship("RecipeIngredient", back_populates="recipe")

class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    category = Column(String, default="Pantry")
    shelf_life_days = Column(Integer, default=30)
    allergens = Column(String, default="None")

class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"))
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"))
    quantity = Column(Float, default=1.0)

    recipe = relationship("Recipe", back_populates="ingredients")
    ingredient = relationship("Ingredient")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    dietary_preferences = Column(String, default="None")

class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"))
    quantity = Column(Float, default=1.0)
    unit = Column(String, default="units")

    user = relationship("User")
    ingredient = relationship("Ingredient")

# Provide the exact alias expected by main.py
InventoryItem = Inventory
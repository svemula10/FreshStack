import React, { useState, useEffect } from 'react';
import KitchenStorage from './components/KitchenStorage';
import RecipeMatcher from './components/RecipeMatcher';

interface InventoryItem {
  id: number;
  user_id: number;
  ingredient_id: number;
  ingredient_name?: string;
  zone?: 'fridge' | 'cabinet' | 'spices';
}

interface Recipe {
  id: number;
  title: string;
  instructions: string;
  prep_time?: string;
  cook_time?: string;
  servings?: string;
  rating?: string;
  url?: string;
  missing_ingredient_count: number;
  matched_count?: number;
  ingredients?: string[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'storage' | 'recipes'>('storage');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [ingredientInput, setIngredientInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [maxTime, setMaxTime] = useState<number>(45);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [offset, setOffset] = useState<number>(0);
  const [expandedRecipeId, setExpandedRecipeId] = useState<number | null>(null);
  const userId = 1;
  const LIMIT = 10;

  const getSingularStem = (name: string): string => {
    let lower = name.trim().toLowerCase();
    if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) {
      lower = lower.slice(0, -1);
    }
    return lower;
  };

  const getDefaultZone = (name: string): 'fridge' | 'cabinet' | 'spices' => {
    const lower = name.toLowerCase();
    const spices = ['salt', 'pepper', 'cinnamon', 'oregano', 'basil', 'cumin', 'paprika', 'thyme', 'rosemary', 'nutmeg', 'chili powder', 'garlic powder', 'onion powder'];
    const fridge = ['butter', 'milk', 'cheese', 'egg', 'yogurt', 'cream', 'chicken', 'beef', 'pork', 'fish', 'lettuce', 'spinach', 'carrot', 'celery', 'apple', 'tofu', 'mayo'];
    
    if (spices.some(s => lower.includes(s))) return 'spices';
    if (fridge.some(f => lower.includes(f))) return 'fridge';
    return 'cabinet';
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/inventory/${userId}`);
      if (res.ok) {
        const data = await res.json();
        const enriched = data.map((item: any) => ({
          ...item,
          zone: item.zone || getDefaultZone(item.ingredient_name || `item-${item.ingredient_id}`)
        }));
        setInventory(enriched);
      }
    } catch (err) {
      console.error("Failed to load inventory", err);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawInput = ingredientInput.trim();
    if (!rawInput) return;

    setErrorMessage(null);
    const inputStem = getSingularStem(rawInput);

    const existingItem = inventory.find(item => {
      const existingName = item.ingredient_name || '';
      return getSingularStem(existingName) === inputStem;
    });

    if (existingItem) {
      if (rawInput.toLowerCase().endsWith('s') && !(existingItem.ingredient_name || '').toLowerCase().endsWith('s')) {
        setInventory(prev =>
          prev.map(item => item.id === existingItem.id ? { ...item, ingredient_name: rawInput.toLowerCase() } : item)
        );
      } else {
        setErrorMessage(`"${rawInput}" is already in your kitchen storage!`);
      }
      setIngredientInput('');
      return;
    }

    const assignedZone = getDefaultZone(rawInput);

    try {
      const ingRes = await fetch(`http://127.0.0.1:8000/ingredients/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: rawInput.toLowerCase(), category: assignedZone })
      });
      
      if (ingRes.ok) {
        const ingredientData = await ingRes.json();
        
        const invRes = await fetch(`http://127.0.0.1:8000/inventory/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, ingredient_id: ingredientData.id })
        });

        if (invRes.ok) {
          const newInvItem = await invRes.json();
          
          setInventory(prev => [
            ...prev,
            {
              id: newInvItem.id || Date.now(),
              user_id: userId,
              ingredient_id: ingredientData.id,
              ingredient_name: rawInput.toLowerCase(),
              zone: assignedZone
            }
          ]);
        }

        setIngredientInput('');
        fetchInventory();
      }
    } catch (err) {
      console.error("Failed to add ingredient", err);
    }
  };

  const handleDeleteIngredient = async (inventoryId: number) => {
    setInventory(prev => prev.filter(item => item.id !== inventoryId));

    try {
      await fetch(`http://127.0.0.1:8000/inventory/${inventoryId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error("Failed to delete inventory item from backend", err);
      fetchInventory();
    }
  };

  const handleDragStart = (e: React.DragEvent, itemId: number) => {
    e.dataTransfer.setData('text/plain', itemId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetZone: 'fridge' | 'cabinet' | 'spices') => {
    e.preventDefault();
    const itemIdStr = e.dataTransfer.getData('text/plain');
    const itemId = parseInt(itemIdStr, 10);

    setInventory(prev =>
      prev.map(item => (item.id === itemId ? { ...item, zone: targetZone } : item))
    );
  };

  const fetchMatchedRecipes = async (reset: boolean = true) => {
    if (reset) {
      setLoading(true);
      setActiveTab('recipes');
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    const currentOffset = reset ? 0 : offset;

    try {
      const res = await fetch(`http://127.0.0.1:8000/recipes/match/${userId}?max_time=${maxTime}&limit=${LIMIT}&offset=${currentOffset}`);
      if (res.ok) {
        const data = await res.json();
        if (reset) {
          setRecipes(data);
        } else {
          setRecipes(prev => [...prev, ...data]);
        }
        setHasMore(data.length === LIMIT);
        setOffset(currentOffset + LIMIT);
      }
    } catch (err) {
      console.error("Failed to fetch recipes", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const toggleRecipeDropdown = (id: number) => {
    setExpandedRecipeId(prev => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#2C2A29] font-sans antialiased px-6 py-10 selection:bg-[#E3DCD2]">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 border-b border-[#E8E2D5] pb-6 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#E5DFD4] shadow-sm flex-shrink-0">
              <img 
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMLmsNsqKpothh9W9jBNebfskd3jHwt23Qm92z9rhtIw&s=10" 
                alt="Fresh ingredients" 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-2xl font-serif tracking-tight text-[#1A1817]">FreshStack</h1>
              <p className="text-sm text-[#706B65] mt-0.5">Your thoughtful virtual pantry and recipe companion</p>
            </div>
          </div>

          <nav className="flex gap-2 bg-[#F2EDE4] p-1 rounded-full border border-[#E5DFD4]">
            <button
              onClick={() => {
                setActiveTab('storage');
                setExpandedRecipeId(null); // Clear open dropdowns when switching tabs
              }}
              className={`px-5 py-2 rounded-full text-xs font-medium transition ${
                activeTab === 'storage' 
                  ? 'bg-white text-[#1A1817] shadow-sm' 
                  : 'text-[#706B65] hover:text-[#1A1817]'
              }`}
            >
              Kitchen Storage
            </button>
            <button
              onClick={() => {
                setActiveTab('recipes');
                setExpandedRecipeId(null); // Clear open dropdowns when switching to recipe tab
                fetchMatchedRecipes(true);
              }}
              className={`px-5 py-2 rounded-full text-xs font-medium transition ${
                activeTab === 'recipes' 
                  ? 'bg-white text-[#1A1817] shadow-sm' 
                  : 'text-[#706B65] hover:text-[#1A1817]'
              }`}
            >
              Find Recipes
            </button>
          </nav>
        </header>

        {/* Tab 1: Storage Page Component */}
        {activeTab === 'storage' && (
          <KitchenStorage 
            inventory={inventory}
            ingredientInput={ingredientInput}
            setIngredientInput={setIngredientInput}
            errorMessage={errorMessage}
            setErrorMessage={setErrorMessage}
            handleAddIngredient={handleAddIngredient}
            handleDeleteIngredient={handleDeleteIngredient}
            handleDragStart={handleDragStart}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            fetchMatchedRecipes={fetchMatchedRecipes}
          />
        )}

        {/* Tab 2: Recipe Matcher Page Component */}
        {activeTab === 'recipes' && (
          <RecipeMatcher 
            recipes={recipes}
            maxTime={maxTime}
            setMaxTime={setMaxTime}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            expandedRecipeId={expandedRecipeId}
            fetchMatchedRecipes={fetchMatchedRecipes}
            toggleRecipeDropdown={toggleRecipeDropdown}
          />
        )}

      </div>
    </div>
  );
}
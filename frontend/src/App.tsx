import React, { useState, useEffect } from 'react';

interface InventoryItem {
  id: number;
  user_id: number;
  ingredient_id: number;
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
  match_score: number;
  missing_ingredient_count: number;
  ingredients: string[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'storage' | 'recipes'>('storage');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [newIngredientId, setNewIngredientId] = useState<string>('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [maxTime, setMaxTime] = useState<number>(60);
  const [loading, setLoading] = useState<boolean>(false);
  const userId = 1;

  // Fetch current user inventory
  const fetchInventory = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/inventory/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setInventory(data);
      }
    } catch (err) {
      console.error("Failed to load inventory", err);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Add ingredient to stock
  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngredientId) return;

    try {
      const res = await fetch(`http://127.0.0.1:8000/inventory/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ingredient_id: parseInt(newIngredientId) })
      });
      if (res.ok) {
        setNewIngredientId('');
        fetchInventory();
      }
    } catch (err) {
      console.error("Failed to add inventory item", err);
    }
  };

  // Fetch matched recipes based on inventory and time limit
  const fetchMatchedRecipes = async () => {
    setLoading(true);
    setActiveTab('recipes');
    try {
      const res = await fetch(`http://127.0.0.1:8000/recipes/match/${userId}?max_time=${maxTime}`);
      if (res.ok) {
        const data = await res.json();
        setRecipes(data);
      }
    } catch (err) {
      console.error("Failed to fetch recipes", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header & Navigation */}
        <header className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-emerald-400">FreshStack</h1>
            <p className="text-zinc-400 text-sm">Algorithmic Pantry & Deterministic Recipe Matcher</p>
          </div>
          <div className="flex gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setActiveTab('storage')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'storage' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              🍳 Kitchen Storage
            </button>
            <button
              onClick={fetchMatchedRecipes}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'recipes' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              ✨ Find Recipes
            </button>
          </div>
        </header>

        {/* Tab 1: Storage / Inventory Page */}
        {activeTab === 'storage' && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-semibold mb-4 text-emerald-300">Add Items to Your Kitchen</h2>
              <form onSubmit={handleAddIngredient} className="flex gap-3">
                <input
                  type="number"
                  placeholder="Enter Ingredient ID (e.g., 1 for butter)"
                  value={newIngredientId}
                  onChange={(e) => setNewIngredientId(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-3 rounded-xl transition shadow-lg shadow-emerald-900/20"
                >
                  Store Item
                </button>
              </form>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-semibold mb-4">Current Household Inventory</h2>
              {inventory.length === 0 ? (
                <p className="text-zinc-500 italic">Your kitchen storage is currently empty. Add some ingredients above!</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {inventory.map((item, idx) => (
                    <div key={idx} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
                      <span className="font-medium text-zinc-200">Ingredient ID: {item.ingredient_id}</span>
                      <span className="text-xs bg-emerald-950 text-emerald-400 px-2 py-1 rounded-md border border-emerald-800">In Stock</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8 text-center">
                <button
                  onClick={fetchMatchedRecipes}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-4 rounded-xl shadow-lg transition w-full sm:w-auto"
                >
                  Ready to Cook? Find Recipes Based On What I Have →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Recipe Matcher Results Page */}
        {activeTab === 'recipes' && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-semibold text-emerald-300">Recipe Matcher Engine</h2>
                <p className="text-zinc-400 text-sm">Filtered by your active inventory and time limit constraints.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-zinc-300">Max Time (mins):</label>
                <input
                  type="number"
                  value={maxTime}
                  onChange={(e) => setMaxTime(Number(e.target.value))}
                  className="w-24 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-center"
                />
                <button
                  onClick={fetchMatchedRecipes}
                  className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg text-sm font-medium transition border border-zinc-700"
                >
                  Apply
                </button>
              </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-zinc-500">Computing deterministic recipe matches...</div>
              ) : recipes.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-400">
                  <p className="text-lg font-medium mb-2">No matching recipes found.</p>
                  <p className="text-sm text-zinc-500">Try adding more ingredients to your kitchen storage or increasing your time limit.</p>
                </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {recipes.map((recipe) => (
                  <div key={recipe.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-white">{recipe.title}</h3>
                        <div className="flex gap-4 text-xs text-zinc-400 mt-1">
                          {recipe.prep_time && <span>Prep: {recipe.prep_time}</span>}
                          {recipe.cook_time && <span>Cook: {recipe.cook_time}</span>}
                          {recipe.servings && <span>Servings: {recipe.servings}</span>}
                          {recipe.rating && <span className="text-amber-400">★ {recipe.rating}</span>}
                        </div>
                      </div>
                      <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-3 py-1 rounded-full text-xs font-semibold">
                        Missing: {recipe.missing_ingredient_count} items
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-zinc-300 mb-1">Instructions:</h4>
                      <p className="text-zinc-400 text-sm leading-relaxed bg-zinc-950 p-4 rounded-xl border border-zinc-800 max-h-40 overflow-y-auto">
                        {recipe.instructions}
                      </p>
                    </div>

                    {recipe.url && (
                      <div className="pt-2">
                        <a
                          href={recipe.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 text-sm font-medium inline-flex items-center gap-1 underline"
                        >
                          View Original Recipe Source ↗
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
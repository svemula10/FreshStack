import React, { useState, useEffect } from 'react';

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
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'storage' | 'recipes'>('storage');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [ingredientInput, setIngredientInput] = useState<string>('');
  const [selectedZone, setSelectedZone] = useState<'fridge' | 'cabinet' | 'spices'>('fridge');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [maxTime, setMaxTime] = useState<number>(45);
  const [loading, setLoading] = useState<boolean>(false);
  const userId = 1;

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

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientInput.trim()) return;

    try {
      const ingRes = await fetch(`http://127.0.0.1:8000/ingredients/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ingredientInput.trim().toLowerCase(), category: selectedZone })
      });
      
      if (ingRes.ok) {
        const ingredientData = await ingRes.json();
        await fetch(`http://127.0.0.1:8000/inventory/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, ingredient_id: ingredientData.id })
        });

        setIngredientInput('');
        fetchInventory();
      }
    } catch (err) {
      console.error("Failed to add ingredient", err);
    }
  };

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
    <div className="min-h-screen bg-[#FBF9F5] text-[#2C2A29] font-sans antialiased px-6 py-10 selection:bg-[#E3DCD2]">
      <div className="max-w-4xl mx-auto">
        
        {/* Calm, Clean Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 border-b border-[#E8E2D5] pb-6 gap-6">
          <div>
            <h1 className="text-2xl font-serif tracking-tight text-[#1A1817]">FreshStack</h1>
            <p className="text-sm text-[#706B65] mt-0.5">Your thoughtful virtual pantry and recipe companion</p>
          </div>

          <nav className="flex gap-2 bg-[#F2EDE4] p-1 rounded-full border border-[#E5DFD4]">
            <button
              onClick={() => setActiveTab('storage')}
              className={`px-5 py-2 rounded-full text-xs font-medium transition ${
                activeTab === 'storage' 
                  ? 'bg-white text-[#1A1817] shadow-sm' 
                  : 'text-[#706B65] hover:text-[#1A1817]'
              }`}
            >
              Kitchen Storage
            </button>
            <button
              onClick={fetchMatchedRecipes}
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

        {/* Tab 1: Storage Page */}
        {activeTab === 'storage' && (
          <div className="space-y-10">
            
            {/* Minimalist Input Card */}
            <div className="bg-white border border-[#E8E2D5] rounded-2xl p-8 shadow-sm">
              <h2 className="text-lg font-serif text-[#1A1817] mb-2">Add to Pantry</h2>
              <p className="text-xs text-[#706B65] mb-6">Type what you brought home to keep your virtual kitchen updated.</p>
              
              <form onSubmit={handleAddIngredient} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="e.g. butter, garlic, fresh basil..."
                  value={ingredientInput}
                  onChange={(e) => setIngredientInput(e.target.value)}
                  className="flex-1 bg-[#FBF9F5] border border-[#E5DFD4] rounded-xl px-4 py-3 text-[#1A1817] placeholder-[#A39D94] focus:outline-none focus:border-[#706B65] text-sm"
                />
                
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value as any)}
                  className="bg-[#FBF9F5] border border-[#E5DFD4] rounded-xl px-4 py-3 text-[#706B65] focus:outline-none focus:border-[#706B65] text-xs font-medium"
                >
                  <option value="fridge">Refrigerator</option>
                  <option value="cabinet">Cabinets</option>
                  <option value="spices">Spice Drawer</option>
                </select>

                <button
                  type="submit"
                  className="bg-[#2C2A29] hover:bg-[#1A1817] text-white text-xs font-medium px-6 py-3 rounded-xl transition"
                >
                  Save Item
                </button>
              </form>
            </div>

            {/* Clean Section Containers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-white border border-[#E8E2D5] rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-[#1A1817] mb-1">Refrigerator</h3>
                <p className="text-[11px] text-[#8C867E] mb-4">Perishables & fresh produce</p>
                <div className="space-y-2">
                  {inventory.length === 0 ? (
                    <p className="text-xs text-[#A39D94] italic py-3">Empty</p>
                  ) : (
                    inventory.map((item, idx) => (
                      <div key={idx} className="bg-[#FBF9F5] border border-[#EFECE6] px-3.5 py-2.5 rounded-lg flex items-center justify-between text-xs">
                        <span className="text-[#2C2A29] font-medium">Item #{item.ingredient_id}</span>
                        <span className="text-[10px] text-[#706B65]">Stored</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white border border-[#E8E2D5] rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-[#1A1817] mb-1">Cabinets</h3>
                <p className="text-[11px] text-[#8C867E] mb-4">Grains & dry staples</p>
                <div className="space-y-2">
                  {inventory.length === 0 ? (
                    <p className="text-xs text-[#A39D94] italic py-3">Empty</p>
                  ) : (
                    inventory.map((item, idx) => (
                      <div key={idx} className="bg-[#FBF9F5] border border-[#EFECE6] px-3.5 py-2.5 rounded-lg flex items-center justify-between text-xs">
                        <span className="text-[#2C2A29] font-medium">Item #{item.ingredient_id}</span>
                        <span className="text-[10px] text-[#706B65]">Stored</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white border border-[#E8E2D5] rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-[#1A1817] mb-1">Spice Drawer</h3>
                <p className="text-[11px] text-[#8C867E] mb-4">Herbs & seasonings</p>
                <div className="space-y-2">
                  {inventory.length === 0 ? (
                    <p className="text-xs text-[#A39D94] italic py-3">Empty</p>
                  ) : (
                    inventory.map((item, idx) => (
                      <div key={idx} className="bg-[#FBF9F5] border border-[#EFECE6] px-3.5 py-2.5 rounded-lg flex items-center justify-between text-xs">
                        <span className="text-[#2C2A29] font-medium">Item #{item.ingredient_id}</span>
                        <span className="text-[10px] text-[#706B65]">Stored</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Seamless Action Flow */}
            <div className="pt-2 text-center">
              <button
                onClick={fetchMatchedRecipes}
                className="bg-[#2C2A29] hover:bg-[#1A1817] text-white text-xs font-medium px-8 py-4 rounded-xl shadow-sm transition"
              >
                Find Recipes You Can Make →
              </button>
            </div>

          </div>
        )}

        {/* Tab 2: Recipe Matcher Page */}
        {activeTab === 'recipes' && (
          <div className="space-y-8">
            
            <div className="bg-white border border-[#E8E2D5] rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
              <div>
                <h2 className="text-lg font-serif text-[#1A1817]">Matched Recipes</h2>
                <p className="text-xs text-[#706B65]">Filtered precisely by your available pantry and time constraints.</p>
              </div>
              <div className="flex items-center gap-2 bg-[#FBF9F5] p-1.5 rounded-xl border border-[#E5DFD4]">
                <label className="text-[11px] font-medium text-[#706B65] px-2">Max Time:</label>
                <input
                  type="number"
                  value={maxTime}
                  onChange={(e) => setMaxTime(Number(e.target.value))}
                  className="w-16 bg-white border border-[#E5DFD4] rounded-lg px-2 py-1 text-[#1A1817] text-center text-xs font-medium focus:outline-none"
                />
                <span className="text-[11px] text-[#8C867E] pr-2">m</span>
                <button
                  onClick={fetchMatchedRecipes}
                  className="bg-[#2C2A29] text-white px-3 py-1.5 rounded-lg text-xs transition"
                >
                  Update
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-16 text-[#8C867E] text-xs">
                Searching recipe sets...
              </div>
            ) : recipes.length === 0 ? (
              <div className="bg-white border border-[#E8E2D5] rounded-2xl p-16 text-center text-[#706B65] space-y-2 shadow-sm">
                <p className="text-sm font-medium text-[#1A1817]">No recipes found.</p>
                <p className="text-xs text-[#8C867E]">Try adding more items to your storage or increasing the time filter.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recipes.map((recipe) => (
                  <div key={recipe.id} className="bg-white border border-[#E8E2D5] rounded-2xl p-6 shadow-sm space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-lg font-serif text-[#1A1817] mb-1">{recipe.title}</h3>
                        <div className="flex gap-4 text-xs text-[#8C867E]">
                          {recipe.prep_time && <span>Prep: {recipe.prep_time}</span>}
                          {recipe.cook_time && <span>Cook: {recipe.cook_time}</span>}
                          {recipe.servings && <span>Servings: {recipe.servings}</span>}
                          {recipe.rating && <span className="text-[#B38B2D]">★ {recipe.rating}</span>}
                        </div>
                      </div>
                      <span className="bg-[#F2EDE4] text-[#4A453F] border border-[#E5DFD4] px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap">
                        Missing: {recipe.missing_ingredient_count}
                      </span>
                    </div>

                    <p className="text-[#4A453F] text-xs leading-relaxed bg-[#FBF9F5] p-4 rounded-xl border border-[#EFECE6] max-h-32 overflow-y-auto">
                      {recipe.instructions}
                    </p>

                    {recipe.url && (
                      <div>
                        <a
                          href={recipe.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#59524A] hover:text-[#1A1817] text-xs font-medium underline inline-flex items-center gap-1"
                        >
                          Original Recipe ↗
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
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

  const formatInstructions = (text: string) => {
    if (!text) return [];
    return text
      .split(/(?<=[.!?])\s+|\n+/)
      .map(step => step.trim())
      .filter(step => step.length > 3 && !step.toLowerCase().startsWith('natalie') && step !== '•');
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
              onClick={() => fetchMatchedRecipes(true)}
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
            
            {/* Input Card */}
            <div className="bg-white border border-[#E8E2D5] rounded-2xl p-8 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 pointer-events-none hidden sm:block">
                <img 
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ1b7g-4IahMgmSCX7FJD5UHepL7hkt00OYLbQnJcXmpw&s=10" 
                  alt="Pantry background" 
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="relative z-10 max-w-lg">
                <h2 className="text-lg font-serif text-[#1A1817] mb-2">Add to Pantry</h2>
                <p className="text-xs text-[#706B65] mb-4">Type what you bought home. FreshStack will automatically place it in the correct zone!</p>
                
                <form onSubmit={handleAddIngredient} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="e.g. butter, garlic, fresh basil..."
                    value={ingredientInput}
                    onChange={(e) => {
                      setIngredientInput(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className="flex-1 bg-[#FBF9F5] border border-[#E5DFD4] rounded-xl px-4 py-3 text-[#1A1817] placeholder-[#A39D94] focus:outline-none focus:border-[#706B65] text-sm"
                  />

                  <button
                    type="submit"
                    className="bg-[#2C2A29] hover:bg-[#1A1817] text-white text-xs font-medium px-6 py-3 rounded-xl transition shadow-sm"
                  >
                    Save Item
                  </button>
                </form>

                {errorMessage && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg mt-3 transition">
                    {errorMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Storage Compartments Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Refrigerator Zone */}
              <div 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'fridge')}
                className="bg-white border border-[#E8E2D5] rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[280px]"
              >
                <div>
                  <div className="h-28 rounded-xl overflow-hidden mb-4 border border-[#EFECE6] group">
                    <img 
                      src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT5XLsvxTXh4d0ajeF5JvwNGGKEJZBXOZDjf9nUTuE-TQ&s=10" 
                      alt="Refrigerator items" 
                      className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <h3 className="text-sm font-semibold text-[#1A1817] mb-1">Refrigerator</h3>
                  <p className="text-[11px] text-[#8C867E] mb-4">Perishables & fresh produce</p>
                  
                  <div className="space-y-2">
                    {inventory.filter(i => i.zone === 'fridge').length === 0 ? (
                      <p className="text-xs text-[#A39D94] italic py-3 text-center">Drag items here or add items</p>
                    ) : (
                      inventory.filter(i => i.zone === 'fridge').map((item) => (
                        <div 
                          key={item.id} 
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, item.id)}
                          className="bg-[#FBF9F5] border border-[#EFECE6] px-3.5 py-2.5 rounded-lg flex items-center justify-between text-xs cursor-grab active:cursor-grabbing hover:border-[#706B65] transition group"
                        >
                          <span className="text-[#2C2A29] font-medium capitalize">
                            {item.ingredient_name || `Item #${item.ingredient_id}`}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#706B65]">Drag</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteIngredient(item.id);
                              }}
                              className="text-[#A39D94] hover:text-red-600 font-bold px-1 transition text-sm"
                              title="Delete ingredient"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Cabinets Zone */}
              <div 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'cabinet')}
                className="bg-white border border-[#E8E2D5] rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[280px]"
              >
                <div>
                  <div className="h-28 rounded-xl overflow-hidden mb-4 border border-[#EFECE6] group">
                    <img 
                      src="https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&q=80&w=400" 
                      alt="Cabinet items" 
                      className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <h3 className="text-sm font-semibold text-[#1A1817] mb-1">Cabinets</h3>
                  <p className="text-[11px] text-[#8C867E] mb-4">Grains & dry staples</p>
                  
                  <div className="space-y-2">
                    {inventory.filter(i => i.zone === 'cabinet').length === 0 ? (
                      <p className="text-xs text-[#A39D94] italic py-3 text-center">Drag items here or add items</p>
                    ) : (
                      inventory.filter(i => i.zone === 'cabinet').map((item) => (
                        <div 
                          key={item.id} 
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, item.id)}
                          className="bg-[#FBF9F5] border border-[#EFECE6] px-3.5 py-2.5 rounded-lg flex items-center justify-between text-xs cursor-grab active:cursor-grabbing hover:border-[#706B65] transition group"
                        >
                          <span className="text-[#2C2A29] font-medium capitalize">
                            {item.ingredient_name || `Item #${item.ingredient_id}`}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#706B65]">Drag</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteIngredient(item.id);
                              }}
                              className="text-[#A39D94] hover:text-red-600 font-bold px-1 transition text-sm"
                              title="Delete ingredient"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Spice Drawer Zone */}
              <div 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'spices')}
                className="bg-white border border-[#E8E2D5] rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[280px]"
              >
                <div>
                  <div className="h-28 rounded-xl overflow-hidden mb-4 border border-[#EFECE6] group">
                    <img 
                      src="https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=400" 
                      alt="Spice drawer" 
                      className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <h3 className="text-sm font-semibold text-[#1A1817] mb-1">Spice Drawer</h3>
                  <p className="text-[11px] text-[#8C867E] mb-4">Herbs & seasonings</p>
                  
                  <div className="space-y-2">
                    {inventory.filter(i => i.zone === 'spices').length === 0 ? (
                      <p className="text-xs text-[#A39D94] italic py-3 text-center">Drag items here or add items</p>
                    ) : (
                      inventory.filter(i => i.zone === 'spices').map((item) => (
                        <div 
                          key={item.id} 
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, item.id)}
                          className="bg-[#FBF9F5] border border-[#EFECE6] px-3.5 py-2.5 rounded-lg flex items-center justify-between text-xs cursor-grab active:cursor-grabbing hover:border-[#706B65] transition group"
                        >
                          <span className="text-[#2C2A29] font-medium capitalize">
                            {item.ingredient_name || `Item #${item.ingredient_id}`}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#706B65]">Drag</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteIngredient(item.id);
                              }}
                              className="text-[#A39D94] hover:text-red-600 font-bold px-1 transition text-sm"
                              title="Delete ingredient"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Action Flow */}
            <div className="pt-2 text-center">
              <button
                onClick={() => fetchMatchedRecipes(true)}
                className="bg-[#2C2A29] hover:bg-[#1A1817] text-white text-xs font-medium px-8 py-4 rounded-xl shadow-sm transition"
              >
                Find Recipes You Can Make →
              </button>
            </div>

          </div>
        )}

        {/* Tab 2: Recipe Matcher Page with Formatted Dropdown */}
        {activeTab === 'recipes' && (
          <div className="space-y-8">
            
            <div className="bg-white border border-[#E8E2D5] rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
              <div>
                <h2 className="text-lg font-serif text-[#1A1817]">Matched Recipes</h2>
                <p className="text-xs text-[#706B65]">Click any recipe card below to view its ingredients and formatted step-by-step instructions.</p>
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
                  onClick={() => fetchMatchedRecipes(true)}
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
                {recipes.map((recipe) => {
                  const isExpanded = expandedRecipeId === recipe.id;
                  const formattedSteps = formatInstructions(recipe.instructions);

                  return (
                    <div 
                      key={recipe.id} 
                      className="bg-white border border-[#E8E2D5] rounded-2xl p-6 shadow-sm transition hover:border-[#B38B2D] cursor-pointer"
                      onClick={() => toggleRecipeDropdown(recipe.id)}
                    >
                      {/* Recipe Card Header Summary */}
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h3 className="text-lg font-serif text-[#1A1817] mb-1">
                            <span>{recipe.title}</span>
                          </h3>
                          <div className="flex gap-4 text-xs text-[#8C867E]">
                            {recipe.prep_time && <span>Prep: {recipe.prep_time}</span>}
                            {recipe.cook_time && <span>Cook: {recipe.cook_time}</span>}
                            {recipe.servings && <span>Servings: {recipe.servings}</span>}
                            {recipe.rating && <span className="text-[#B38B2D]">★ {recipe.rating}</span>}
                          </div>
                        </div>
                        <span className="text-xs text-[#706B65] font-medium whitespace-nowrap hover:text-[#1A1817] transition">
                          {isExpanded ? '▲ Hide Details' : '▼ View Details'}
                        </span>
                      </div>

                      {/* Expandable Dropdown Content */}
                      {isExpanded && (
                        <div 
                          className="mt-6 pt-6 border-t border-[#EFECE6] space-y-6 animate-fadeIn cursor-default"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Ingredients List */}
                          {recipe.ingredients && recipe.ingredients.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#706B65] mb-3">Ingredients Needed:</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#FBF9F5] p-4 rounded-xl border border-[#EFECE6]">
                                {recipe.ingredients.map((ing, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-xs text-[#4A453F]">
                                    <span className="text-[#B38B2D] font-bold">•</span>
                                    <span>{ing}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Beautiful Step-by-Step Formatted Instructions */}
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#706B65] mb-3">Step-by-Step Instructions:</h4>
                            <div className="space-y-3 bg-[#FBF9F5] p-5 rounded-xl border border-[#EFECE6]">
                              {formattedSteps.length > 0 ? (
                                formattedSteps.map((step, idx) => (
                                  <div key={idx} className="flex items-start gap-3 text-xs text-[#4A453F] leading-relaxed">
                                    <span className="bg-[#E8E2D5] text-[#1A1817] font-semibold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">
                                      {idx + 1}
                                    </span>
                                    <p className="flex-1 pt-0.5">{step}</p>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-[#4A453F]">{recipe.instructions}</p>
                              )}
                            </div>
                          </div>

                          {recipe.url && (
                            <div>
                              <a
                                href={recipe.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#59524A] hover:text-[#1A1817] text-xs font-medium underline inline-flex items-center gap-1"
                              >
                                Original Recipe Source ↗
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Load More Button */}
                {hasMore && (
                  <div className="pt-4 text-center">
                    <button
                      onClick={() => fetchMatchedRecipes(false)}
                      disabled={loadingMore}
                      className="bg-white border border-[#E8E2D5] hover:border-[#706B65] text-[#2C2A29] text-xs font-medium px-8 py-3.5 rounded-xl shadow-sm transition"
                    >
                      {loadingMore ? 'Loading more recipes...' : 'Load More Recipes ↓'}
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
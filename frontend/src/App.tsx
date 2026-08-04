import { useState, useEffect } from 'react';

interface Ingredient {
  id: number;
  name: string;
  quantity: number;
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
  ingredients: Ingredient[];
}

export default function App() {
  const [inventory, setInventory] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [maxTime, setMaxTime] = useState<number>(60); // Default 60 minute limit
  const [loading, setLoading] = useState(false);
  const userId = 1; // Default MVP user

  // Fetch matched recipes based on current time filter
  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/recipes/match/${userId}?max_time=${maxTime}`);
      const data = await res.json();
      setRecipes(data);
    } catch (err) {
      console.error("Failed to fetch matched recipes", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, [maxTime]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-6 md:p-12">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-400">FreshStack</h1>
          <p className="text-zinc-400 text-sm mt-1">Algorithmic Pantry & Deterministic Recipe Engine</p>
        </div>
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Time Limit:</span>
          <select 
            value={maxTime} 
            onChange={(e) => setMaxTime(Number(e.target.value))}
            className="bg-zinc-800 text-emerald-400 font-medium px-2 py-1 rounded-lg focus:outline-none"
          >
            <option value={30}>Under 30 mins</option>
            <option value={45}>Under 45 mins</option>
            <option value={60}>Under 60 mins</option>
            <option value={120}>Under 2 hours</option>
            <option value={999}>Any Time</option>
          </select>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Pantry Inventory */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 h-fit backdrop-blur-sm">
          <h2 className="text-lg font-bold text-zinc-200 mb-4 flex items-center justify-between">
            <span>Home Inventory</span>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/20">
              Active Stock
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mb-4">
            Ingredients currently logged in your pantry. Used by the deterministic matching engine.
          </p>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {/* Sample hardcoded list for MVP visual state; can be tied to a GET /inventory endpoint */}
            <div className="flex justify-between items-center p-3 bg-zinc-950/50 border border-zinc-800/50 rounded-xl">
              <span className="text-sm font-medium text-zinc-300">Olive Oil</span>
              <span className="text-xs text-zinc-500">1 bottle</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-zinc-950/50 border border-zinc-800/50 rounded-xl">
              <span className="text-sm font-medium text-zinc-300">Garlic</span>
              <span className="text-xs text-zinc-500">4 cloves</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-zinc-950/50 border border-zinc-800/50 rounded-xl">
              <span className="text-sm font-medium text-zinc-300">White Rice</span>
              <span className="text-xs text-zinc-500">500g</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-zinc-950/50 border border-zinc-800/50 rounded-xl">
              <span className="text-sm font-medium text-zinc-300">Salt & Pepper</span>
              <span className="text-xs text-zinc-500">Staples</span>
            </div>
          </div>
        </div>

        {/* Right Columns: Recipe Recommendations */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-zinc-100">Matched Recipes</h2>
            <button 
              onClick={fetchRecipes}
              className="text-xs bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-emerald-500/10"
            >
              Refresh Matcher
            </button>
          </div>

          {loading ? (
            <div className="text-center py-20 text-zinc-500">Running deterministic set-matching engine...</div>
          ) : recipes.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-10 text-center text-zinc-400">
              No recipes found matching your inventory and time constraint. Try expanding your inventory or time threshold!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {recipes.map((recipe) => (
                <div key={recipe.id} className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 hover:border-zinc-700 transition">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                    <h3 className="text-lg font-bold text-zinc-100">{recipe.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-lg">
                        ⏱ {recipe.prep_time || "Prep N/A"} {recipe.cook_time ? `/ ${recipe.cook_time} cook` : ""}
                      </span>
                      {recipe.rating && (
                        <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg font-semibold">
                          ★ {recipe.rating}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-400 mb-4">
                    <span className="text-emerald-400 font-medium">
                      Match Score: {Math.round(recipe.match_score * 100)}%
                    </span>
                    <span>•</span>
                    <span>Missing Items: {recipe.missing_ingredient_count}</span>
                    {recipe.servings && <><span>•</span><span>Yields: {recipe.servings} servings</span></>}
                  </div>

                  <div className="bg-zinc-950/60 rounded-xl p-4 border border-zinc-900 mb-4">
                    <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Instructions</h4>
                    <p className="text-sm text-zinc-300 leading-relaxed line-clamp-3">
                      {recipe.instructions}
                    </p>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-zinc-800/50">
                    <span className="text-xs text-zinc-500">ID: #{recipe.id}</span>
                    {recipe.url ? (
                      <a 
                        href={recipe.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition"
                      >
                        View Original Recipe ↗
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-600">Local Custom Recipe</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
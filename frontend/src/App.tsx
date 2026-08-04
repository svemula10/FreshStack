import React, { useEffect, useState } from 'react';

interface Ingredient {
  id: number;
  name: string;
}

interface Recipe {
  id: number;
  title: string;
  ingredients: Ingredient[];
}

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const userId = 1; // Default mock user ID

  useEffect(() => {
    fetch(`http://localhost:8000/recipes/match/${userId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch matched recipes from backend.');
        }
        return res.json();
      })
      .then((data) => {
        setRecipes(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching recipes:", err);
        setError("Could not connect to the FastAPI backend. Ensure the server is running on port 8000.");
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <header className="max-w-4xl mx-auto mb-8 border-b pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-emerald-600">FreshStack</h1>
        <p className="text-sm text-gray-600 mt-1">Algorithmic Pantry & Constraint Engine</p>
      </header>

      <main className="max-w-4xl mx-auto grid gap-6">
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Matched Recipes (Deterministic Set-Theory)</h2>

          {loading && <p className="text-gray-500 animate-pulse">Evaluating pantry constraints...</p>}

          {error && (
            <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {!loading && !error && recipes.length === 0 && (
            <p className="text-gray-500">
              No matching recipes found based on your current pantry inventory. Try adding inventory items via the Swagger docs at <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="text-emerald-600 underline">http://localhost:8000/docs</a>.
            </p>
          )}

          {!loading && recipes.length > 0 && (
            <div className="grid gap-4">
              {recipes.map((recipe) => (
                <div key={recipe.id} className="p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <h3 className="font-semibold text-lg text-gray-800">{recipe.title}</h3>
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-1 items-center">
                    <span className="font-medium text-gray-700">Required Ingredients:</span>
                    {recipe.ingredients.map((i) => (
                      <span key={i.id} className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-medium">
                        {i.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
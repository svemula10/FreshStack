import React, { useState } from 'react';

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

interface RecipeMatcherProps {
  recipes: Recipe[];
  maxTime: number;
  setMaxTime: (val: number) => void;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  expandedRecipeId: number | null;
  fetchMatchedRecipes: (reset?: boolean, hours?: number, mins?: number) => void;
  toggleRecipeDropdown: (id: number) => void;
}

export default function RecipeMatcher({
  recipes,
  maxTime,
  setMaxTime,
  loading,
  loadingMore,
  hasMore,
  expandedRecipeId,
  fetchMatchedRecipes,
  toggleRecipeDropdown
}: RecipeMatcherProps) {

  // Local side-by-side time states for hours and minutes
  const [maxHours, setMaxHours] = useState<number>(0);
  const [maxMins, setMaxMins] = useState<number>(45);

  const formatInstructions = (text: string) => {
    if (!text) return [];
    return text
      .split(/(?<=[.!?])\s+|\n+/)
      .map(step => step.trim())
      .filter(step => step.length > 3 && !step.toLowerCase().startsWith('natalie') && step !== '•');
  };

  return (
    <div className="space-y-8">
      
      {/* Header and Side-by-Side Time Selector */}
      <div className="bg-white border border-[#E8E2D5] rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-serif text-[#1A1817]">Matched Recipes</h2>
          <p className="text-xs text-[#706B65]">Filter by max cooking time and click any recipe to view details.</p>
        </div>
        
        {/* Side-by-Side Hours & Minutes Selectors */}
        <div className="flex items-center gap-2 bg-[#FBF9F5] p-1.5 rounded-xl border border-[#E5DFD4]">
          <span className="text-[11px] font-medium text-[#706B65] pl-2">Max Time:</span>
          
          {/* Hours Input */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="12"
              value={maxHours}
              onChange={(e) => setMaxHours(Math.max(0, Number(e.target.value)))}
              className="w-12 bg-white border border-[#E5DFD4] rounded-lg px-2 py-1 text-[#1A1817] text-center text-xs font-medium focus:outline-none"
            />
            <span className="text-[11px] text-[#8C867E]">hr</span>
          </div>

          {/* Minutes Input */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="59"
              step="5"
              value={maxMins}
              onChange={(e) => setMaxMins(Math.max(0, Number(e.target.value)))}
              className="w-12 bg-white border border-[#E5DFD4] rounded-lg px-2 py-1 text-[#1A1817] text-center text-xs font-medium focus:outline-none"
            />
            <span className="text-[11px] text-[#8C867E] pr-1">min</span>
          </div>

          <button
            onClick={() => {
              const totalMins = (maxHours * 60) + maxMins;
              setMaxTime(totalMins);
              // Pass the exact hours and minutes to the fetch function
              fetchMatchedRecipes(true, maxHours, maxMins);
            }}
            className="bg-[#2C2A29] text-white px-3 py-1.5 rounded-lg text-xs transition"
          >
            Apply
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
          <p className="text-xs text-[#8C867E]">Try increasing your maximum time filter or adding more items to your pantry.</p>
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

                    {/* Step-by-Step Formatted Instructions */}
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
  );
}
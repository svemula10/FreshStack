import React from 'react';

interface InventoryItem {
  id: number;
  user_id: number;
  ingredient_id: number;
  ingredient_name?: string;
  zone?: 'fridge' | 'cabinet' | 'spices';
}

interface KitchenStorageProps {
  inventory: InventoryItem[];
  ingredientInput: string;
  setIngredientInput: (val: string) => void;
  errorMessage: string | null;
  setErrorMessage: (val: string | null) => void;
  handleAddIngredient: (e: React.FormEvent) => void;
  handleDeleteIngredient: (id: number) => void;
  handleDragStart: (e: React.DragEvent, id: number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, zone: 'fridge' | 'cabinet' | 'spices') => void;
  fetchMatchedRecipes: (reset?: boolean) => void;
}

export default function KitchenStorage({
  inventory,
  ingredientInput,
  setIngredientInput,
  errorMessage,
  setErrorMessage,
  handleAddIngredient,
  handleDeleteIngredient,
  handleDragStart,
  handleDragOver,
  handleDrop,
  fetchMatchedRecipes
}: KitchenStorageProps) {
  return (
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
  );
}
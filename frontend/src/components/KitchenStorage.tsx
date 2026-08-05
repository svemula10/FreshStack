import React, { useState } from 'react';

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
  userId?: number;
  fetchInventory?: () => void;
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
  fetchMatchedRecipes,
  userId = 1,
  fetchInventory
}: KitchenStorageProps) {
  const [parsingReceipt, setParsingReceipt] = useState<boolean>(false);
  const [detectedItems, setDetectedItems] = useState<string[]>([]);
  const [addingParsed, setAddingParsed] = useState<boolean>(false);

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

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setParsingReceipt(true);
    setDetectedItems([]);
    
    const fileInputTarget = e.target;

    try {
      const res = await fetch(`http://127.0.0.1:8000/inventory/scan-receipt/${userId}`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const rawItems = data.detected_items || data.added_ingredients || [];
        
        const trulyNewItems = rawItems.filter((itemName: string) => {
          const stem = getSingularStem(itemName);
          return !inventory.some(existing => {
            const existingName = existing.ingredient_name || '';
            return getSingularStem(existingName) === stem;
          });
        });

        if (trulyNewItems.length === 0) {
          alert("All items detected in this receipt are already in your kitchen storage!");
        } else {
          setDetectedItems(trulyNewItems);
        }
      }
    } catch (err) {
      console.error("Receipt parsing failed", err);
    } finally {
      setParsingReceipt(false);
      if (fileInputTarget) {
        fileInputTarget.value = '';
      }
    }
  };

  const handleCommitParsedItems = async () => {
    if (detectedItems.length === 0) return;

    setAddingParsed(true);
    try {
      const itemsToCommit = [...detectedItems];
      setDetectedItems([]);

      for (const itemName of itemsToCommit) {
        const assignedZone = getDefaultZone(itemName);

        const ingRes = await fetch(`http://127.0.0.1:8000/ingredients/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: itemName, category: assignedZone })
        });
        
        if (ingRes.ok) {
          const ingData = await ingRes.json();
          await fetch(`http://127.0.0.1:8000/inventory/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, ingredient_id: ingData.id, zone: assignedZone })
          });
        }
      }

      // --- INSTANT SYNC TRIGGER ---
      if (fetchInventory) {
        await fetchInventory();
        setTimeout(() => fetchInventory(), 100);
      }
    } catch (err) {
      console.error("Failed to commit parsed receipt items", err);
    } finally {
      setAddingParsed(false);
    }
  };

  return (
    <div className="space-y-10">
      
      {/* Input Card with Clean Receipt Upload & Staged List Flow */}
      <div className="bg-white border border-[#E8E2D5] rounded-2xl p-8 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 pointer-events-none hidden sm:block">
          <img 
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ1b7g-4IahMgmSCX7FJD5UHepL7hkt00OYLbQnJcXmpw&s=10" 
            alt="Pantry background" 
            className="w-full h-full object-cover"
          />
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <div>
            <h2 className="text-lg font-serif text-[#1A1817] mb-2">Add to Pantry</h2>
            
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

          {/* Clean Receipt Upload Button */}
          <div className="pt-4 border-t border-[#F2EDE4] space-y-4">
            <label className="inline-block bg-[#F2EDE4] border border-[#E5DFD4] text-[#1A1817] text-xs font-medium px-4 py-2.5 rounded-xl cursor-pointer hover:bg-[#E8E2D5] transition">
              {parsingReceipt ? 'Extracting Key Items...' : 'Upload Receipt 📄'}
              <input type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
            </label>

            {/* Staged Items List & Commit Button */}
            {detectedItems.length > 0 && (
              <div className="bg-[#FBF9F5] border border-[#E5DFD4] rounded-xl p-4 space-y-3 animate-fadeIn">
                <h4 className="text-xs font-bold text-[#1A1817] uppercase tracking-wider">Detected New Items:</h4>
                <div className="flex flex-wrap gap-2">
                  {detectedItems.map((item, idx) => (
                    <span key={idx} className="bg-white border border-[#E8E2D5] text-[#2C2A29] text-xs px-3 py-1 rounded-lg font-medium shadow-2xs capitalize">
                      ✓ {item}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleCommitParsedItems}
                  disabled={addingParsed}
                  className="w-full mt-2 bg-[#2C2A29] hover:bg-[#1A1817] text-white text-xs font-medium py-2.5 rounded-lg transition shadow-sm"
                >
                  {addingParsed ? 'Adding to Pantry...' : 'Add Items From Receipt →'}
                </button>
              </div>
            )}
          </div>
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
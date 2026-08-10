# FreshStack - Algorithmic Recipe-Matching Engine

FreshStack bridges the gap between what's sitting in your kitchen and what you can actually cook with it. Built as a full-stack virtual pantry platform, FreshStack lets users log their household inventory and instantly surfaces recipes they can make right now — filtered by ingredient availability, time constraints, and how close a match is to what's already on hand.

## 🌟 Key Features
- **Virtual Pantry Management**: Users maintain a live inventory of ingredients on hand, updated as items are added, consumed, or restocked.
- **Set-Based Matching Engine**: Filters a database of 2,000+ recipes against the user's current pantry using set-intersection logic, ranking recipes by ingredient overlap and estimated prep/cook time.
- **Fuzzy Ingredient Standardization**: Uses RapidFuzz-powered matching pipelines to parse unstructured ingredient text (e.g., recipe scrapes or manual entry) and normalize it against a standardized ingredient taxonomy, handling variations in naming, pluralization, and phrasing.
- **Bulk Recipe Ingestion**: Supports bulk import of recipes from unstructured text sources, automatically extracting and mapping ingredient lists into structured, queryable records.
- **Time-Aware Filtering**: Recipes can be filtered not just by ingredient availability but by total time constraints, helping users find realistic options for their current schedule.
- **Allergy & Dietary Filtering**: Excludes recipes containing user-specified allergens or restricted ingredients, ensuring match results are safe and relevant to individual dietary needs.

## 🛠️ Tech Stack

**Frontend**: React, TypeScript, Vite, Tailwind CSS

**Backend**: FastAPI (Python)

**Database**: SQLite

**Matching & Data Processing**: RapidFuzz for fuzzy string matching and ingredient normalization; Python set operations for the core matching engine

## 📂 System Architecture & Directory Map

```
FreshStack/
├── frontend/                     # React + TypeScript + Vite UI
│   ├── src/
│   │   ├── App.tsx               # Central state orchestrator & view router
│   │   ├── main.tsx              # React application entry point
│   │   ├── index.css             # Global styling
│   │   └── components/
│   │       ├── KitchenStorage.tsx  # Pantry inventory management UI
│   │       └── RecipeMatcher.tsx   # Recipe matching & results display
│   └── package.json
├── backend/                      # FastAPI server
│   ├── app/
│   │   ├── main.py               # REST API endpoints
│   │   ├── models.py             # Database models
│   │   ├── schemas.py            # Pydantic data models & validation structures
│   │   ├── database.py           # SQLite table initialization & persistence logic
│   │   └── engine.py             # Set-based matching engine & ranking logic
│   ├── import_csv.py             # Bulk recipe ingestion & RapidFuzz ingredient normalization
│   ├── recipes.csv               # Source recipe dataset
│   ├── freshstack.db             # SQLite database file
│   └── requirements.txt
└── README.md
```

## 🚀 Getting Started Locally
 
### 1. Prerequisites
- **Node.js & npm**: required for running the React frontend
- **Python (3.9+)**: required for running the FastAPI backend server
### 2. Clone the Repository
```bash
git clone https://github.com/svemula10/FreshStack.git
cd FreshStack
```
 
### 3. Run the Backend
```bash
cd backend
 
# Install dependencies
pip install -r requirements.txt
 
# The repo includes a pre-seeded freshstack.db, so no setup is needed.
# To reset or re-import the recipe dataset from scratch, run:
# python import_csv.py
 
# Start the FastAPI server
uvicorn app.main:app --reload
```
 
### 4. Run the Frontend
```bash
cd frontend
 
# Install Node modules
npm install
 
# Start the Vite development server
npm run dev
```
 
Open your browser and navigate to `http://localhost:5173` to interact with FreshStack.


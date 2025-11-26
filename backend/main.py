from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import random
import os
from typing import List

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Score Model
class Score(BaseModel):
    score: int
    name: str = "Player"

# In-memory storage for scores (replace with DB for persistence)
scores_db: List[Score] = []

@app.post("/scores")
async def submit_score(score: Score):
    scores_db.append(score)
    # Sort scores descending
    scores_db.sort(key=lambda x: x.score, reverse=True)
    # Keep top 100
    if len(scores_db) > 100:
        scores_db.pop()
    return {"message": "Score submitted"}

@app.get("/scores")
async def get_scores():
    return scores_db[:10]

@app.get("/stage/random")
async def get_random_stage(exclude_id: str = None):
    stages_dir = "backend/stages"
    if not os.path.exists(stages_dir):
        raise HTTPException(status_code=500, detail="Stages directory not found")
    
    files = [f for f in os.listdir(stages_dir) if f.endswith('.json')]
    if not files:
        raise HTTPException(status_code=404, detail="No stages found")
    
    # Filter out excluded stage if possible
    available_files = files
    if exclude_id:
        # Assuming filename matches ID (e.g., flat.json -> flat)
        available_files = [f for f in files if f != f"{exclude_id}.json"]
    
    # If filtering removed all files (e.g. only 1 stage exists), fallback to all files
    if not available_files:
        available_files = files
    
    random_file = random.choice(available_files)
    with open(os.path.join(stages_dir, random_file), 'r') as f:
        stage_data = json.load(f)
    
    return stage_data

@app.get("/stage/start")
async def get_start_point():
    stages_dir = "backend/stages"
    start_file = "flat.json"
    file_path = os.path.join(stages_dir, start_file)
    
    if not os.path.exists(file_path):
        # Fallback if flat.json is missing
        return {
            "id": "flat_fallback",
            "width": 800,
            "elements": [
                { "type": "platform", "x": 0, "y": 500, "width": 800, "height": 50 }
            ]
        }
        
    with open(file_path, 'r') as f:
        stage_data = json.load(f)
    
    return stage_data

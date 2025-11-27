from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import random
import os
from typing import List, Optional
from pathlib import Path

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

# Chunk Definition Model
class ChunkElement(BaseModel):
    type: str
    subtype: Optional[str] = None
    blockType: Optional[str] = None
    x: float
    y: float
    width: float
    height: float
    properties: Optional[dict] = None

class ChunkDef(BaseModel):
    id: str
    width: float
    elements: List[ChunkElement]

# In-memory storage for scores (replace with DB for persistence)
scores_db: List[Score] = []

STAGES_DIR = Path("backend/stages")

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

@app.get("/stage/random", response_model=List[ChunkDef])
async def get_random_stage(exclude_id: Optional[str] = None, count: int = 20):
    if not STAGES_DIR.exists():
        raise HTTPException(status_code=500, detail="Stages directory not found")
    
    stage_files = list(STAGES_DIR.glob("*.json"))
    if not stage_files:
        raise HTTPException(status_code=404, detail="No stages found")
    
    stages = []
    current_exclude_id = exclude_id
    
    for _ in range(count):
        # Filter out excluded stage if possible
        available_files = stage_files
        if current_exclude_id:
            available_files = [f for f in stage_files if f.stem != current_exclude_id]
        
        # If filtering removed all files (e.g. only 1 stage exists), fallback to all files
        if not available_files:
            available_files = stage_files
        
        selected_file = random.choice(available_files)
        with open(selected_file, 'r') as f:
            stage_data = json.load(f)
            stages.append(stage_data)
            current_exclude_id = stage_data.get("id")
    
    return stages

@app.get("/stage/start")
async def get_start_point():
    start_file = STAGES_DIR / "flat.json"
    
    if not start_file.exists():
        # Fallback if flat.json is missing
        return {
            "id": "flat_fallback",
            "width": 800,
            "elements": [
                { "type": "platform", "x": 0, "y": 500, "width": 800, "height": 50 }
            ]
        }
        
    with open(start_file, 'r') as f:
        stage_data = json.load(f)
    
    return stage_data

@app.post("/stage")
async def publish_stage(stage: ChunkDef):
    if not STAGES_DIR.exists():
        STAGES_DIR.mkdir(parents=True, exist_ok=True)
    
    # Generate unique ID if not present or collision
    stage_id = stage.id
    if not stage_id:
        stage_id = f"custom_{random.randint(1000, 9999)}"
        stage.id = stage_id
    
    file_path = STAGES_DIR / f"{stage_id}.json"
    
    # Save to file
    with open(file_path, 'w') as f:
        json.dump(stage.dict(), f, indent=2)
    
    return {"message": "Stage published", "id": stage_id}

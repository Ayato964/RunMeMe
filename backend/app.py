from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

app = FastAPI()

# Serve the built CSS from the frontend/dist directory
app.mount("/dist", StaticFiles(directory="frontend/dist"), name="dist")

@app.get("/")
async def read_index():
    return FileResponse('frontend/index.html')

@app.get("/api")
async def read_api():
    return {"message": "Hello from FastAPI!"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

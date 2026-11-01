import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from .database.database import engine, Base
from .api import api_router

# Create database tables if not existing
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CPU Performance Explorer API",
    description="Computer Organization & Architecture Diagnostics, Microarchitectural Simulation & Real Hardware Telemetry Suite",
    version="4.2.0"
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "CPU Performance Explorer",
        "version": "4.2.0",
        "engine": "COA Diagnostic Kernel V4.2"
    }

# Mount API routes
app.include_router(api_router)

# Mount frontend directory for static serving
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend")
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/", include_in_schema=False)
def root_redirect():
    # Redirect to the main Dashboard page
    return RedirectResponse(url="/Dahboard.html")

@app.get("/CurrentDevice.html", include_in_schema=False)
def current_device_redirect():
    return RedirectResponse(url="/Dahboard.html")

# Serve frontend HTML directly from frontend directory
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
elif os.path.exists(ROOT_DIR):
    app.mount("/", StaticFiles(directory=ROOT_DIR, html=True), name="frontend_root")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)


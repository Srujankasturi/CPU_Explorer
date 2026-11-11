import sys
import os
import webbrowser
import threading
import time
import uvicorn

def open_browser():
    time.sleep(1.2)
    url = "http://127.0.0.1:8000/Dashboard.html"
    print(f"\n[+] Opening CPU Performance Explorer in your browser: {url}\n")
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Could not open browser automatically: {e}")

def main():
    print("=" * 66)
    print("   CPU PERFORMANCE EXPLORER")
    print("   Architecture Diagnostics & Pipeline Simulation Suite")
    print("=" * 66)
    print("   [+] Fast-API Backend Engine Active")
    print("   [+] Real hardware monitoring enabled (psutil)")
    print("   [+] 5-Stage RISC Pipeline Simulator loaded")
    print("   [+] Microarchitectural TMA Engine ready")
    print("   [+] Web App:     http://127.0.0.1:8000/Dashboard.html")
    print("   [+] API Docs:    http://127.0.0.1:8000/docs")
    print("=" * 66)

    # Launch browser in a background thread
    threading.Thread(target=open_browser, daemon=True).start()

    # Start Uvicorn Server
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=False)

if __name__ == "__main__":
    main()


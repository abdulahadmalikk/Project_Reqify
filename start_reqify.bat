@echo off
echo Starting Reqify Fullstack Application...

:: Ensure Node and Python are available in this script's path (in case it inherited an old path)
set PATH=%PATH%;C:\Program Files\nodejs\;C:\Users\AbdulAhad\AppData\Local\Microsoft\WindowsApps;C:\Users\AbdulAhad\AppData\Local\Programs\Python\Python311\Scripts\;C:\Users\AbdulAhad\AppData\Local\Programs\Python\Python311\

:: 1. Start AI Engine
echo Starting Python AI Engine...
start "Reqify AI Engine" cmd /k "cd reqify_fullstack\backend\python_ai_engine && set PYTHONIOENCODING=utf-8 && .\venv_win\Scripts\python.exe -u -m uvicorn main:app --port 8000"

:: 2. Start Express Backend
echo Starting Express Backend...
start "Reqify Node Server" cmd /k "cd reqify_fullstack\backend\express_server && node server.js"

:: 3. Start Frontend
echo Starting React Frontend...
start "Reqify Frontend" cmd /k "cd reqify_fullstack\frontend && npm start"

echo All services are starting in separate windows! Check the new terminal windows for the live logs.
pause

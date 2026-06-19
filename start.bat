@echo off
echo Starting Cleanroom Monitoring System...

:: Start Backend in a new window using the existing venv
echo Starting FastAPI Backend...
start cmd /k "cd /d %~dp0 && .\venv\Scripts\activate && cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Start Frontend in a new window (First kill any process on port 3001)
echo Starting React Frontend on port 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":3001 "') do taskkill /f /pid %%a 2>nul
start cmd /k "cd /d %~dp0frontend && npm run dev"

:: Start UART Bridge in a new window
echo Starting UART Bridge...
start cmd /k "cd /d %~dp0 && .\venv\Scripts\python.exe uart_bridge.py"

echo All systems are starting!
echo Backend will be available at: http://localhost:8000
echo Frontend will be available at: http://localhost:3001

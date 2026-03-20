@echo off
REM Script simples para iniciar Frontend e Backend
REM Frontend: porta 3005
REM Backend: porta 3001

echo.
echo ========================================
echo   Portal Evoque - Dev Environment
echo ========================================
echo.
echo Iniciando Backend (porta 3001)...
echo.

start "BACKEND" cmd /k "cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 3001 --reload"

timeout /t 3 /nobreak

echo.
echo Iniciando Frontend (porta 3005)...
echo.

start "FRONTEND" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo Servidores iniciados!
echo ========================================
echo.
echo Frontend:        http://localhost:3005
echo Backend API:     http://localhost:3001
echo Backend Docs:    http://localhost:3001/docs
echo.
echo Feche as janelas para parar os servidores.
echo.
pause

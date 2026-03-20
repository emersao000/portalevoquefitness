@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Portal Evoque - Dev Environment
echo ========================================
echo.

REM Limpar e reinstalar dependências do Frontend
echo Limpando e reinstalando dependencias do Frontend...
cd frontend
if exist "node_modules" (
    echo Removendo node_modules...
    rmdir /s /q node_modules 2>nul
)
if exist "package-lock.json" (
    echo Removendo package-lock.json...
    del /q package-lock.json
)
echo Instalando dependencias...
call npm install
if errorlevel 1 (
    echo.
    echo ERRO ao instalar dependencias do Frontend!
    echo Verifique se Node.js e npm estao instalados corretamente.
    pause
    exit /b 1
)
cd ..
echo Dependencias do Frontend instaladas com sucesso!
echo.

echo Iniciando Backend (porta 3001)...
start "Backend" cmd /k "cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 3001 --reload"

timeout /t 3 /nobreak

echo Iniciando Frontend (porta 3005)...
start "Frontend" cmd /k "cd frontend && npm run dev"

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

@echo off
title OceanOS - Launcher
color 0B
chcp 65001 >nul 2>&1

cd /d "%~dp0"

set "WWW_DIR=%~dp0"
set "MOBYWORK_DIR=%WWW_DIR%Mobywork"

set "NODE_CMD=node"
set "VS_NODE_DIR=C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs"

if exist "%VS_NODE_DIR%\node.exe" set "NODE_CMD=%VS_NODE_DIR%\node.exe"

cls
echo.
echo  ================================================
echo       OceanOS -- Launcher apps
echo  ================================================
echo.
echo  Backend API  :  http://localhost:3002
echo  Dashboard    :  http://localhost:5173/Mobywork/
echo  Comptes      :  Flowcean / Invocean
echo  ================================================
echo.

echo  Nettoyage des anciens processus Node.js pour liberer les ports...
taskkill /IM node.exe /F >nul 2>&1

echo  [1/2] Lancement du backend Node.js (port 3002)...
start "Mobywork Backend" cmd /k "cd /d ""%MOBYWORK_DIR%\backend"" && ""%NODE_CMD%"" server.js"

timeout /t 3 >nul

echo  [2/2] Lancement du frontend Vite React (port 5173)...
start "Mobywork Frontend" cmd /k "cd /d ""%MOBYWORK_DIR%\frontend"" && ""%NODE_CMD%"" .\node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173"

timeout /t 5 >nul

echo.
echo  Ouverture du dashboard...
start "" "http://localhost:5173/Mobywork/"

echo.
echo  Tout est lance. Vous pouvez fermer cette fenetre.
timeout /t 5 >nul
exit

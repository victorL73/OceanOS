@echo off
title OceanOS - Launcher
color 0B
chcp 65001 >nul 2>&1

cd /d "%~dp0"

set "WWW_DIR=%~dp0"

cls
echo.
echo  ================================================
echo       OceanOS -- Launcher apps
echo  ================================================
echo.
echo  Portail      :  http://localhost/OceanOS/
echo  Modules      :  OceanOS
echo  ================================================
echo.

echo.
echo  Ouverture du portail...
start "" "http://localhost/OceanOS/"

echo.
echo  C'est ouvert. Vous pouvez fermer cette fenetre.
timeout /t 5 >nul
exit

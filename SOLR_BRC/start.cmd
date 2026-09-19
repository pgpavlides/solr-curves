@echo off
REM Sol-R Curves: runs the built app if there is one, otherwise the dev build.
cd /d "%~dp0"
if exist "src-tauri	argetelease\solr-curves.exe" (
  start "" "src-tauri	argetelease\solr-curves.exe"
  exit /b
)
if not exist node_modules call npm install
call npm run dev

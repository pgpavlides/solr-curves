@echo off
REM Sol-R Curves: starts the app and opens it in the browser.
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run dev

@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 18+ is required. Install it from https://nodejs.org/ & pause & exit /b 1)
if not exist .env copy .env.example .env >nul
echo.
echo Dependencies will now be installed.
npm install || (echo Dependency installation failed. & pause & exit /b 1)
echo.
echo IMPORTANT: Edit .env and configure MONGODB_URI and a strong JWT_SECRET.
echo Start MongoDB, then run: npm start
 echo.
pause

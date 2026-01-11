# Codex Editor - Start All Services
# This script starts both the Socket.io server and the React app

Write-Host "🚀 Starting Codex Editor Services..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the correct directory
if (-Not (Test-Path ".\package.json")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Start Socket.io server in background
Write-Host "📡 Starting Socket.io Server (Port 4000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd server; node socket-server.js"

# Wait a moment for server to start
Start-Sleep -Seconds 2

# Start React app
Write-Host "⚛️  Starting React App (Port 3000)..." -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Codex Editor is starting!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Socket.io Server: http://localhost:4000" -ForegroundColor Yellow
Write-Host "React App:        http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the React app" -ForegroundColor Gray
Write-Host "Close the other PowerShell window to stop Socket.io server" -ForegroundColor Gray
Write-Host ""

npm start

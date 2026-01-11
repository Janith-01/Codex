# Quick Fix: Restart React with Environment Variables
# This script stops the current React server and restarts it

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Restarting React App" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Current .env file contents:" -ForegroundColor Yellow
Get-Content .env | ForEach-Object {
    if ($_ -match "REACT_APP_") {
        Write-Host "  ✓ $_" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "⚠️  NOTE: You need to manually restart the React app!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Steps:" -ForegroundColor Cyan
Write-Host "  1. Find the terminal running 'npm start'" -ForegroundColor White
Write-Host "  2. Press Ctrl+C to stop it" -ForegroundColor White
Write-Host "  3. Run 'npm start' again" -ForegroundColor White
Write-Host ""
Write-Host "Or just run this command in the project root:" -ForegroundColor Cyan
Write-Host "  npm start" -ForegroundColor Green
Write-Host ""

# Playwright Test Setup Script
# Run this to install Playwright browsers and dependencies

Write-Host "Setting up Playwright E2E tests..." -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: Must run from frontend directory" -ForegroundColor Red
    exit 1
}

# Install npm dependencies
Write-Host "`nInstalling npm dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: npm install failed" -ForegroundColor Red
    exit 1
}

# Install Playwright browsers
Write-Host "`nInstalling Playwright browsers..." -ForegroundColor Yellow
npx playwright install

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Playwright browser installation failed" -ForegroundColor Red
    exit 1
}

# Install system dependencies (Linux only, but won't hurt on Windows)
Write-Host "`nInstalling system dependencies..." -ForegroundColor Yellow
npx playwright install-deps 2>$null

# Check if Python environment is set up
Write-Host "`nChecking Python environment..." -ForegroundColor Yellow

# Check if uv is installed
$uvCheck = Get-Command uv -ErrorAction SilentlyContinue

if (-not $uvCheck) {
    Write-Host "Warning: 'uv' command not found. Install it with: pip install uv" -ForegroundColor Yellow
    Write-Host "Or visit: https://github.com/astral-sh/uv" -ForegroundColor Yellow
} else {
    $pythonCheck = uv run python --version 2>$null

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: Python environment not found. Run 'uv sync' from project root." -ForegroundColor Yellow
    } else {
        Write-Host "Python environment: OK ($pythonCheck)" -ForegroundColor Green
    }
}

# Build frontend
Write-Host "`nBuilding frontend..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Frontend build failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Playwright setup complete!" -ForegroundColor Green
Write-Host "`nYou can now run tests with:" -ForegroundColor Cyan
Write-Host "  npm run test:e2e          - Run all tests" -ForegroundColor White
Write-Host "  npm run test:e2e:ui       - Run with UI mode" -ForegroundColor White
Write-Host "  npm run test:e2e:headed   - Run in headed mode" -ForegroundColor White
Write-Host "  npm run test:e2e:debug    - Run in debug mode" -ForegroundColor White

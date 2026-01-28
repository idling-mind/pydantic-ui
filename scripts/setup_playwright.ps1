# Setup Playwright for Python E2E tests
# Run this script to install Playwright and its browser dependencies

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Playwright Setup for Python E2E Tests" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "pyproject.toml")) {
    Write-Host "Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Step 1: Install Python dependencies
Write-Host "`n1. Installing Python dependencies..." -ForegroundColor Yellow

try {
    Write-Host "Installing with uv..." -ForegroundColor Gray
    uv pip install -e ".[dev]"
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "uv not found, trying with pip..." -ForegroundColor Yellow
    try {
        pip install -e ".[dev]"
        Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
        Write-Host "Please install dependencies manually:" -ForegroundColor Yellow
        Write-Host "  uv pip install -e .[dev]" -ForegroundColor White
        Write-Host "  OR" -ForegroundColor White
        Write-Host "  pip install -e .[dev]" -ForegroundColor White
        exit 1
    }
}

# Step 2: Install Playwright browsers
Write-Host "`n2. Installing Playwright browsers..." -ForegroundColor Yellow

try {
    Write-Host "Installing all browsers..." -ForegroundColor Gray
    playwright install
    Write-Host "✓ Playwright browsers installed successfully" -ForegroundColor Green
} catch {
    Write-Host "Failed to install all browsers, trying Chromium only..." -ForegroundColor Yellow
    try {
        playwright install chromium
        Write-Host "✓ Chromium browser installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed to install Playwright browsers" -ForegroundColor Red
        Write-Host "Please install browsers manually:" -ForegroundColor Yellow
        Write-Host "  playwright install" -ForegroundColor White
        exit 1
    }
}

# Step 3: Verify installation
Write-Host "`n3. Verifying installation..." -ForegroundColor Yellow

try {
    $playwrightVersion = python -c "import playwright; print(playwright.__version__)"
    Write-Host "✓ Playwright Python package installed (version $playwrightVersion)" -ForegroundColor Green
} catch {
    Write-Host "✗ Playwright Python package not found" -ForegroundColor Red
    exit 1
}

# Step 4: Check installed browsers
Write-Host "`n4. Checking installed browsers..." -ForegroundColor Yellow

$browserCheck = playwright install --dry-run 2>&1 | Out-String

if ($browserCheck -match "chromium") {
    Write-Host "✓ Chromium browser ready" -ForegroundColor Green
}
if ($browserCheck -match "firefox") {
    Write-Host "✓ Firefox browser ready" -ForegroundColor Green
}
if ($browserCheck -match "webkit") {
    Write-Host "✓ WebKit browser ready" -ForegroundColor Green
}

# Success message
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "✓ Playwright setup completed successfully!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "`nYou can now run E2E tests:" -ForegroundColor White
Write-Host "  uv run pytest tests/e2e/" -ForegroundColor Cyan
Write-Host "`nFor more information, see tests/e2e/README.md" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan

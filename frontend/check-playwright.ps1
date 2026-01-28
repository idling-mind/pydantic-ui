# Playwright Test Status Checker
# Quick check if Playwright is ready to run tests

Write-Host "`n=== Playwright E2E Test Status ===" -ForegroundColor Cyan

$allGood = $true

# Check if we're in the frontend directory
if (Test-Path "package.json") {
    Write-Host "✓ In frontend directory" -ForegroundColor Green
} else {
    Write-Host "✗ Not in frontend directory (cd to frontend)" -ForegroundColor Red
    $allGood = $false
}

# Check if node_modules exists
if (Test-Path "node_modules") {
    Write-Host "✓ Node modules installed" -ForegroundColor Green
} else {
    Write-Host "✗ Node modules missing (run: npm install)" -ForegroundColor Red
    $allGood = $false
}

# Check if Playwright is installed
$playwrightCheck = npx playwright --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Playwright installed: $playwrightCheck" -ForegroundColor Green
} else {
    Write-Host "✗ Playwright not installed (run: npx playwright install)" -ForegroundColor Red
    $allGood = $false
}

# Check if browsers are installed
$chromiumPath = "$env:LOCALAPPDATA\ms-playwright\chromium-*"
if (Test-Path $chromiumPath) {
    Write-Host "✓ Chromium browser installed" -ForegroundColor Green
} else {
    Write-Host "⚠ Chromium browser might not be installed (run: npx playwright install)" -ForegroundColor Yellow
}

# Check if frontend is built
if (Test-Path "dist") {
    Write-Host "✓ Frontend built" -ForegroundColor Green
} else {
    Write-Host "⚠ Frontend not built (run: npm run build)" -ForegroundColor Yellow
}

# Check Python environment
Write-Host "`nChecking Python environment..." -ForegroundColor Cyan

# Check if uv is installed
$uvCheck = Get-Command uv -ErrorAction SilentlyContinue

if (-not $uvCheck) {
    Write-Host "✗ 'uv' command not found" -ForegroundColor Red
    Write-Host "  Install with: pip install uv" -ForegroundColor Yellow
    Write-Host "  Or visit: https://github.com/astral-sh/uv" -ForegroundColor Yellow
    $allGood = $false
} else {
    $pythonCheck = uv run python --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Python environment ready: $pythonCheck" -ForegroundColor Green
    } else {
        Write-Host "⚠ Python environment not found (run: uv sync from project root)" -ForegroundColor Yellow
        $allGood = $false
    }
}

# Check if test files exist
$testFiles = @(
    "e2e\app.spec.ts",
    "e2e\tree-navigation.spec.ts",
    "e2e\field-renderers.spec.ts",
    "e2e\data-operations.spec.ts",
    "e2e\ui-config.spec.ts",
    "e2e\helpers.ts"
)

$missingFiles = @()
foreach ($file in $testFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -eq 0) {
    Write-Host "✓ All test files present ($($testFiles.Count) files)" -ForegroundColor Green
} else {
    Write-Host "✗ Missing test files: $($missingFiles -join ', ')" -ForegroundColor Red
    $allGood = $false
}

# Check if playwright.config.ts exists
if (Test-Path "playwright.config.ts") {
    Write-Host "✓ Playwright config present" -ForegroundColor Green
} else {
    Write-Host "✗ Playwright config missing" -ForegroundColor Red
    $allGood = $false
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan

if ($allGood) {
    Write-Host "✅ Everything looks good! Ready to run tests." -ForegroundColor Green
    Write-Host "`nRun tests with:" -ForegroundColor White
    Write-Host "  npm run test:e2e          - Run all tests" -ForegroundColor Cyan
    Write-Host "  npm run test:e2e:ui       - Interactive UI mode" -ForegroundColor Cyan
    Write-Host "  npm run test:e2e:headed   - Watch in browser" -ForegroundColor Cyan
} else {
    Write-Host "❌ Some issues found. Please fix them before running tests." -ForegroundColor Red
    Write-Host "`nTo set up everything, run:" -ForegroundColor White
    Write-Host "  .\setup-playwright.ps1" -ForegroundColor Cyan
}

Write-Host ""

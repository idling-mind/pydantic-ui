#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Test script for pydantic-ui full application
.DESCRIPTION
    Builds the React frontend, copies it to the static folder, and starts the dev server
.PARAMETER SkipBuild
    Skip the frontend build step (use existing build)
.PARAMETER SkipNpmInstall
    Skip npm install step
.PARAMETER Port
    Port to run the dev server on (default: 8000)
.PARAMETER Example
    Which example to run: 'main' or 'simple' (default: 'main')
.PARAMETER OpenBrowser
    Automatically open the browser after starting the server
#>

param(
    [switch]$SkipBuild,
    [switch]$SkipNpmInstall,
    [int]$Port = 8000,
    [ValidateSet('main', 'simple')]
    [string]$Example = 'main',
    [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

# Store root directory
$RootDir = $PSScriptRoot | Split-Path -Parent
$FrontendDir = Join-Path $RootDir "frontend"
$ExamplesDir = Join-Path (Join-Path $RootDir "examples") "basic"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Pydantic UI - Full Application Test" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build frontend (unless skipped)
if (-not $SkipBuild) {
    Write-Host "[1/3] Building Frontend..." -ForegroundColor Yellow
    Write-Host "---------------------------------------------" -ForegroundColor DarkGray
    
    Set-Location $FrontendDir
    
    # Install dependencies if needed
    if (-not $SkipNpmInstall) {
        Write-Host "  -> Installing npm dependencies..." -ForegroundColor Gray
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: Failed to install npm dependencies" -ForegroundColor Red
            exit 1
        }
        Write-Host "  -> Dependencies installed successfully" -ForegroundColor Green
    } else {
        Write-Host "  -> Skipping npm install" -ForegroundColor DarkGray
    }
    
    # Build
    Write-Host "  -> Running production build..." -ForegroundColor Gray
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Failed to build frontend" -ForegroundColor Red
        exit 1
    }
    Write-Host "  -> Frontend built successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[1/3] Skipping frontend build (using existing)" -ForegroundColor DarkGray
    Write-Host ""
}

# Step 2: Copy to static folder
Write-Host "[2/3] Copying Build to Static Folder..." -ForegroundColor Yellow
Write-Host "---------------------------------------------" -ForegroundColor DarkGray

Set-Location $RootDir
node scripts/copy-to-package.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Failed to copy build files" -ForegroundColor Red
    exit 1
}
Write-Host "  -> Files copied successfully" -ForegroundColor Green
Write-Host ""

# Step 3: Start the dev server
Write-Host "[3/3] Starting Dev Server..." -ForegroundColor Yellow
Write-Host "---------------------------------------------" -ForegroundColor DarkGray

$ExampleFile = Join-Path $ExamplesDir "$Example.py"
if (-not (Test-Path $ExampleFile)) {
    Write-Host "  ERROR: Example file not found: $ExampleFile" -ForegroundColor Red
    exit 1
}

Write-Host "  -> Example: $Example.py" -ForegroundColor Gray
Write-Host "  -> Port: $Port" -ForegroundColor Gray
Write-Host ""

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Server Starting..." -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Open your browser at:" -ForegroundColor White
Write-Host "  http://localhost:$Port/config" -ForegroundColor Green
Write-Host ""
Write-Host "  Press Ctrl+C to stop the server" -ForegroundColor DarkGray
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Open browser if requested
if ($OpenBrowser) {
    Start-Process "http://localhost:$Port/config"
}

# Set location to examples directory and run
Set-Location $ExamplesDir

# Run the Python server
python $ExampleFile

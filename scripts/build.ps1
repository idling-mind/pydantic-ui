#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build script for pydantic-ui package
.DESCRIPTION
    Builds the React frontend and copies it to the Python package
#>

param(
    [switch]$SkipNpmInstall,
    [switch]$Development
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== Pydantic UI Full Build ===" -ForegroundColor Cyan
Write-Host ""

# Store root directory
$RootDir = $PSScriptRoot | Split-Path -Parent
$FrontendDir = Join-Path $RootDir "frontend"

# Navigate to frontend
Write-Host "Navigating to frontend directory..." -ForegroundColor Yellow
Set-Location $FrontendDir

# Install dependencies if needed
if (-not $SkipNpmInstall) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install npm dependencies" -ForegroundColor Red
        exit 1
    }
}

# Build frontend
Write-Host "Building frontend..." -ForegroundColor Yellow
if ($Development) {
    npm run build -- --mode development
} else {
    npm run build
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build frontend" -ForegroundColor Red
    exit 1
}

# Copy to package
Write-Host "Copying build to Python package..." -ForegroundColor Yellow
Set-Location $RootDir
node scripts/copy-to-package.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to copy build files" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Build Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "You can now install the package with:"
Write-Host "  pip install -e ." -ForegroundColor Cyan
Write-Host ""

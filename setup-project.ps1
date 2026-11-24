# PedalPass + ESP32 Smart Bike Lock — Automated One-Click Setup Script
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " PedalPass + ESP32 Smart Bike Lock — Project Setup" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$SupabaseUrl = "https://zxhdfkcsbdsmtyfwhqej.supabase.co"
$SupabaseKey = "sb_publishable_xcQbqUx91M9kH_cTZi_9Mg_gb_8Umuv"

# 1. Ensure environment files exist (since .gitignore excludes .env files from GitHub)
$MobileEnv = Join-Path $Root "mobile\.env.local"
if (-not (Test-Path $MobileEnv)) {
    Write-Host "[1/4] Creating mobile\.env.local..." -ForegroundColor Yellow
    Set-Content -Path $MobileEnv -Value "EXPO_PUBLIC_SUPABASE_URL=$SupabaseUrl`nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$SupabaseKey" -Encoding UTF8
}

$WebEnv = Join-Path $Root "web\.env"
if (-not (Test-Path $WebEnv)) {
    Write-Host "[1/4] Creating web\.env..." -ForegroundColor Yellow
    Set-Content -Path $WebEnv -Value "VITE_SUPABASE_URL=$SupabaseUrl`nVITE_SUPABASE_PUBLISHABLE_KEY=$SupabaseKey" -Encoding UTF8
}

$AngularEnv = Join-Path $Root "web-angular\src\environments\environment.ts"
if (-not (Test-Path $AngularEnv)) {
    Write-Host "[1/4] Creating web-angular\src\environments\environment.ts..." -ForegroundColor Yellow
    $NgContent = @"
export const environment = {
  supabaseUrl: '$SupabaseUrl',
  supabaseKey: '$SupabaseKey',
};
"@
    Set-Content -Path $AngularEnv -Value $NgContent -Encoding UTF8
}

# 2. Install npm packages in web/
Write-Host "`n[2/4] Installing dependencies in web/ (Admin Portal - React)..." -ForegroundColor Green
Set-Location (Join-Path $Root "web")
npm install --no-audit --no-fund

# 3. Install npm packages in mobile/
Write-Host "`n[3/4] Installing dependencies in mobile/ (Student & Faculty App - Expo)..." -ForegroundColor Green
Set-Location (Join-Path $Root "mobile")
npm install --no-audit --no-fund

# 4. Install npm packages in web-angular/ and patch Node 22 version check
Write-Host "`n[4/4] Installing dependencies in web-angular/ (Admin Portal - Angular 22)..." -ForegroundColor Green
Set-Location (Join-Path $Root "web-angular")
npm install --no-audit --no-fund

$NgVersionFile = Join-Path $Root "web-angular\node_modules\@angular\cli\src\utilities\node-version.js"
if (Test-Path $NgVersionFile) {
    (Get-Content $NgVersionFile) -replace '\^22\.22\.3', '^22.12.0' | Set-Content $NgVersionFile -Encoding UTF8
}

Set-Location $Root
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " Setup Complete! You can now run start-all.bat or use" -ForegroundColor Green
Write-Host " VS Code -> Terminal -> Run Task to launch the apps." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# Setup local PostgreSQL for Test Hub (Docker Compose).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-local-db.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Fail($msg) {
  Write-Host "ERROR: $msg" -ForegroundColor Red
  exit 1
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail @"
Docker is not installed or not in PATH.

Install Docker Desktop for Windows, then run:
  npm run db:local:up
  npm run db:local:setup

Or install PostgreSQL 16 locally and set DATABASE_URL in .env to:
  postgresql://testhub:testhub_local@127.0.0.1:5432/test_hub?schema=public
"@
}

Write-Host "Starting local PostgreSQL container..." -ForegroundColor Cyan
docker compose up -d postgres

Write-Host "Waiting for database to be ready..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  $status = docker inspect -f "{{.State.Health.Status}}" test-hub-postgres 2>$null
  if ($status -eq "healthy") {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 2
}

if (-not $ready) {
  Fail "PostgreSQL container did not become healthy. Check: docker logs test-hub-postgres"
}

Write-Host "Running migrations..." -ForegroundColor Cyan
npm run db:migrate:deploy

Write-Host "Seeding super admin (and question bank import from seed.ts)..." -ForegroundColor Cyan
npm run db:seed

Write-Host ""
Write-Host "Local database is ready." -ForegroundColor Green
Write-Host "DATABASE_URL should be:" -ForegroundColor Green
Write-Host "  postgresql://testhub:testhub_local@127.0.0.1:5432/test_hub?schema=public"
Write-Host ""
Write-Host "Restart dev server: npm run dev"

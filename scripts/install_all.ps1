$ErrorActionPreference = 'Stop'

$root = Resolve-Path "$PSScriptRoot\.."
$venvPy = Join-Path $root ".venv\Scripts\python.exe"

# Create venv if missing
if (!(Test-Path $venvPy)) {
  Write-Host "Creating virtual environment..."
  python -m venv (Join-Path $root ".venv")
}

if (!(Test-Path $venvPy)) {
  throw "Could not find venv python at $venvPy"
}

Write-Host "Installing Python dependencies (pipeline)..."
& $venvPy -m pip install --upgrade pip
& $venvPy -m pip install -r (Join-Path $root "pipeline\requirements.txt")

Write-Host "Installing Node dependencies (frontend)..."
Set-Location (Join-Path $root "frontend")
npm install

if (!(Test-Path ".env.local") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env.local"
  Write-Host "Created frontend/.env.local from .env.example"
}

Write-Host "Done. Next run:"
Write-Host "  1) .\scripts\run_pipeline.ps1 -RawRoot 'D:\path\to\slides'"
Write-Host "  2) .\scripts\run_frontend.ps1"

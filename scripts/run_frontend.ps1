$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\.."
Set-Location (Join-Path $root "frontend")

$venvPy = Join-Path $root ".venv\Scripts\python.exe"
if (Test-Path $venvPy) {
  $env:RAG_PYTHON_BIN = $venvPy
}

if (!(Test-Path ".env.local") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env.local"
  Write-Host "Created frontend/.env.local from .env.example. Please fill required keys."
}

Write-Host "Starting frontend at http://localhost:3000"
npm run dev

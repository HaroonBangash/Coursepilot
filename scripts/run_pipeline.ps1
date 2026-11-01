param(
  [string]$RawRoot = "",
  [string]$DataDir = "",
  [switch]$CleanData
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\.."
Set-Location (Join-Path $root "pipeline")

$venvPy = Join-Path $root ".venv\Scripts\python.exe"
$py = if (Test-Path $venvPy) { $venvPy } else { "python" }

if ($RawRoot -eq "") {
  $RawRoot = (Join-Path (Get-Location) "input\corpus")
}
if ($DataDir -eq "") {
  $DataDir = (Join-Path (Get-Location) "data")
}

$env:RAG_RAW_ROOT = $RawRoot
$env:RAG_DATA_DIR = $DataDir

if ($CleanData -and (Test-Path $DataDir)) {
  Remove-Item -Recurse -Force $DataDir
}

Write-Host "RAG_RAW_ROOT = $env:RAG_RAW_ROOT"
Write-Host "RAG_DATA_DIR = $env:RAG_DATA_DIR"

& $py .\src\scan_corpus.py
& $py .\src\extract_ppt_pdf.py
& $py .\src\clean_text.py
& $py .\src\build_chunks.py
& $py .\src\create_index.py

if (!(Test-Path ".\data\index\faiss.index")) {
  throw "Index build failed: .\data\index\faiss.index not found"
}

Write-Host "Pipeline complete (index ready)."
Write-Host "Now run: .\scripts\run_frontend.ps1"

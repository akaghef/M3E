param(
    [switch]$SkipPull
)

$ErrorActionPreference = 'Stop'

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

function Ensure-Ollama {
    if (Get-Command ollama -ErrorAction SilentlyContinue) {
        return
    }

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "ollama is not installed and winget is unavailable. Install Ollama manually: https://ollama.com/download"
    }

    Write-Host "Installing Ollama via winget..."
    winget install -e --id Ollama.Ollama --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "winget install Ollama failed."
    }

    Start-Sleep -Seconds 2
    if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
        throw "Ollama install completed but command is not in PATH yet. Open a new shell and rerun this script."
    }
}

Write-Host "[1/3] Ensure Ollama is installed..."
Ensure-Ollama

Write-Host "[2/3] Start Ollama runtime if needed..."
$null = Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden -PassThru -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

if (-not $SkipPull) {
    Write-Host "[3/3] Pull gemma3:4b model..."
    ollama pull gemma3:4b
    if ($LASTEXITCODE -ne 0) {
        throw "ollama pull gemma3:4b failed."
    }
} else {
    Write-Host "[3/3] Skip model pull (SkipPull=true)."
}

Write-Host "Done. Quick check command:"
Write-Host "  ollama run gemma3:4b \"hello\""
Write-Host "Recommended M3E AI env:"
Write-Host "  M3E_AI_PROVIDER=ollama"
Write-Host "  M3E_AI_TRANSPORT=openai-compatible"
Write-Host "  M3E_AI_BASE_URL=http://localhost:11434/v1"
Write-Host "  M3E_AI_API_KEY=ollama"
Write-Host "  M3E_AI_MODEL=gemma3:4b"

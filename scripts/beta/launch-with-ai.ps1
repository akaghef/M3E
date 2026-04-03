param(
    [Parameter(Mandatory = $true)]
    [string]$BitwardenItem,
    [switch]$Update
)

$ErrorActionPreference = 'Stop'

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

function Get-FieldValue {
    param(
        [object]$Item,
        [string[]]$Names
    )

    foreach ($name in $Names) {
        $field = @($Item.fields) | Where-Object { $_.name -eq $name } | Select-Object -First 1
        if ($null -ne $field -and $null -ne $field.value -and "$($field.value)".Trim().Length -gt 0) {
            return "$($field.value)".Trim()
        }
    }

    return $null
}

function Stop-Port4173 {
    $listeners = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in @($listeners)) {
        if ($listener.OwningProcess -and $listener.OwningProcess -ne 0) {
            Write-Host "Stopping existing process on port 4173 (PID $($listener.OwningProcess))..."
            Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

Require-Command bw
Require-Command npm
Require-Command git

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not $env:BW_SESSION) {
    throw "BW_SESSION is not set. Run 'bw unlock' first and export BW_SESSION before launch."
}

$itemJson = bw get item $BitwardenItem --session $env:BW_SESSION
if (-not $itemJson) {
    throw "Bitwarden item not found: $BitwardenItem"
}

$item = $itemJson | ConvertFrom-Json
$apiKey = if ($item.login.password) { "$($item.login.password)".Trim() } else { $null }
if (-not $apiKey) {
    $apiKey = Get-FieldValue -Item $item -Names @("api_key", "M3E_AI_API_KEY", "deepseek_api_key")
}

$provider = Get-FieldValue -Item $item -Names @("provider", "ai_provider", "M3E_AI_PROVIDER")
$transport = Get-FieldValue -Item $item -Names @("transport", "ai_transport", "M3E_AI_TRANSPORT")
$baseUrl = Get-FieldValue -Item $item -Names @("base_url", "endpoint", "M3E_AI_BASE_URL")
$model = Get-FieldValue -Item $item -Names @("model", "default_model", "M3E_AI_MODEL")

$effectiveProvider = if ($provider) { $provider } else { "deepseek" }

if (-not $apiKey -and $effectiveProvider -eq "ollama") {
    $apiKey = "ollama"
}
if (-not $apiKey) {
    throw "API key was not found in the Bitwarden item password or known custom fields."
}

$env:M3E_AI_ENABLED = "1"
$env:M3E_AI_API_KEY = $apiKey
$env:M3E_AI_PROVIDER = $effectiveProvider
$env:M3E_AI_TRANSPORT = if ($transport) { $transport } else { "openai-compatible" }
if ($baseUrl) {
    $env:M3E_AI_BASE_URL = $baseUrl
} elseif ($effectiveProvider -eq "ollama") {
    $env:M3E_AI_BASE_URL = "http://localhost:11434/v1"
} else {
    $env:M3E_AI_BASE_URL = "https://api.deepseek.com"
}
if ($model) {
    $env:M3E_AI_MODEL = $model
} elseif ($effectiveProvider -eq "ollama") {
    $env:M3E_AI_MODEL = "gemma3:4b"
} else {
    $env:M3E_AI_MODEL = "deepseek-chat"
}
$env:M3E_LINEAR_TRANSFORM_SYSTEM_PROMPT_FILE = Join-Path $repoRoot "beta\prompts\linear-agent\system.txt"
$env:M3E_LINEAR_TRANSFORM_TREE_TO_LINEAR_PROMPT_FILE = Join-Path $repoRoot "beta\prompts\linear-agent\tree-to-linear.txt"
$env:M3E_LINEAR_TRANSFORM_LINEAR_TO_TREE_PROMPT_FILE = Join-Path $repoRoot "beta\prompts\linear-agent\linear-to-tree.txt"
$env:M3E_TOPIC_SUGGEST_PROMPT_FILE = Join-Path $repoRoot "beta\prompts\topic-agent\topic-suggest.txt"
$env:M3E_DATA_DIR = Join-Path $repoRoot "beta\data"

if (-not (Test-Path $env:M3E_DATA_DIR)) {
    New-Item -ItemType Directory -Path $env:M3E_DATA_DIR | Out-Null
}

Stop-Port4173

if ($Update) {
    Write-Host "[1/4] Git fetch..."
    git fetch --all
    if ($LASTEXITCODE -ne 0) { throw "git fetch failed." }

    Write-Host "[2/4] Git pull..."
    git pull --ff-only
    if ($LASTEXITCODE -ne 0) { throw "git pull failed." }

    Write-Host "[3/4] Install dependencies (beta)..."
    npm --prefix beta ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }

    Write-Host "[4/4] Build (beta)..."
    npm --prefix beta run build
    if ($LASTEXITCODE -ne 0) { throw "beta build failed." }
}

Write-Host "Launching Beta with AI provider=$($env:M3E_AI_PROVIDER) model=$($env:M3E_AI_MODEL)"
npm --prefix beta start
if ($LASTEXITCODE -ne 0) {
    throw "Beta launch failed."
}

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
if (-not $env:M3E_HOME) { $env:M3E_HOME = Join-Path $env:LOCALAPPDATA "M3E" }
$env:M3E_CHANNEL = "beta"
if (-not $env:M3E_WORKSPACE_ID) { $env:M3E_WORKSPACE_ID = "ws_REMH1Z5TFA7S93R3HA0XK58JNR" }
if (-not $env:M3E_WORKSPACE_LABEL) { $env:M3E_WORKSPACE_LABEL = "Akaghef-personal" }
if (-not $env:M3E_MAP_ID) { $env:M3E_MAP_ID = "map_BG9BZP6NRDTEH1JYNDFGS6S3T5" }
if (-not $env:M3E_MAP_LABEL) { $env:M3E_MAP_LABEL = "開発" }
if (-not $env:M3E_MAP_SLUG) { $env:M3E_MAP_SLUG = "beta-dev" }
if (-not $env:M3E_SEED_DB_PATH) { $env:M3E_SEED_DB_PATH = Join-Path $env:M3E_HOME "seeds\core-seed.sqlite" }
if ($Update) {
    & (Join-Path $PSScriptRoot "update-and-launch.bat")
} else {
    & (Join-Path $PSScriptRoot "launch.bat")
}
if ($LASTEXITCODE -ne 0) { throw "Beta launch failed." }

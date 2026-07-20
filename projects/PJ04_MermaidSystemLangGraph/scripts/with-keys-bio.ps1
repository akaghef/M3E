# with-keys-bio.ps1 — Windows Hello (biometric) gated wrapper for Bitwarden CLI.
#
# 目的: master password 入力を 1 回だけにし、以降は指紋 / 顔 / PIN で済ませる。
#
# Flow:
#   1. Windows Hello プロンプト (UserConsentVerifier).
#   2. 認証OKなら DPAPI から BW_SESSION 復号 → そのまま使う.
#   3. 失効/未cacheなら `bw unlock --raw` (master password 1回) → DPAPI 再保存.
#   4. BW_SESSION + API キーを子プロセス env に注入 → exec.
#
# Storage:
#   HKCU:\Software\M3E\Secrets\BW_SESSION  (DPAPI / CurrentUser)
#   master password 自体は保存しない (session token のみ).
#
# Usage:
#   .\with-keys-bio.ps1 -Setup                        # 1回目セットアップ (master pw 必須)
#   .\with-keys-bio.ps1 -Status                       # 現在の cache 状態確認
#   .\with-keys-bio.ps1 -Reset                        # cache 削除
#   .\with-keys-bio.ps1 -- python script.py           # 通常使用 (fingerprint のみ)

[CmdletBinding(DefaultParameterSetName='Run')]
param(
    [Parameter(ParameterSetName='Setup')]  [switch]$Setup,
    [Parameter(ParameterSetName='Reset')]  [switch]$Reset,
    [Parameter(ParameterSetName='Status')] [switch]$Status,
    [Parameter(ParameterSetName='Run', ValueFromRemainingArguments=$true)]
    [string[]]$Command
)

$ErrorActionPreference = "Stop"
$RegPath  = "HKCU:\Software\M3E\Secrets"
$RegName  = "BW_SESSION"

# ---------- helpers ----------------------------------------------------------

function Invoke-Hello {
    param([string]$Message = "Unlock M3E secrets")
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGen = [System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and `
                       $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } |
        Select-Object -First 1
    [Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType=WindowsRuntime] | Out-Null
    $availOp = [Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()
    $availT  = $asTaskGen.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerifierAvailability]).Invoke($null, @($availOp))
    $avail   = $availT.GetAwaiter().GetResult()
    if ($avail -ne [Windows.Security.Credentials.UI.UserConsentVerifierAvailability]::Available) {
        throw "Windows Hello unavailable: $avail (set up fingerprint/face/PIN in Settings → Accounts → Sign-in options)"
    }
    $verifyOp = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync($Message)
    $verifyT  = $asTaskGen.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerificationResult]).Invoke($null, @($verifyOp))
    $result   = $verifyT.GetAwaiter().GetResult()
    if ($result -ne [Windows.Security.Credentials.UI.UserConsentVerificationResult]::Verified) {
        throw "Hello verification failed: $result"
    }
}

function Get-CachedSession {
    if (-not (Test-Path $RegPath)) { return $null }
    $val = (Get-ItemProperty -Path $RegPath -Name $RegName -ErrorAction SilentlyContinue).$RegName
    if (-not $val) { return $null }
    Add-Type -AssemblyName System.Security
    try {
        $bytes = [Convert]::FromBase64String($val)
        $plain = [System.Security.Cryptography.ProtectedData]::Unprotect(
            $bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
        return [System.Text.Encoding]::UTF8.GetString($plain)
    } catch {
        Write-Warning "DPAPI decrypt failed: $($_.Exception.Message)"
        return $null
    }
}

function Set-CachedSession {
    param([string]$Value)
    Add-Type -AssemblyName System.Security
    if (-not (Test-Path $RegPath)) { New-Item -Path $RegPath -Force | Out-Null }
    $bytes  = [System.Text.Encoding]::UTF8.GetBytes($Value)
    $cipher = [System.Security.Cryptography.ProtectedData]::Protect(
        $bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    Set-ItemProperty -Path $RegPath -Name $RegName -Value ([Convert]::ToBase64String($cipher))
}

function Remove-CachedSession {
    if (Test-Path $RegPath) {
        Remove-ItemProperty -Path $RegPath -Name $RegName -ErrorAction SilentlyContinue
    }
}

function Test-BwSession {
    param([string]$Session)
    if (-not $Session) { return $false }
    $env:BW_SESSION = $Session
    try {
        $json = bw status 2>$null | ConvertFrom-Json
        return ($json.status -eq "unlocked")
    } catch { return $false }
}

function Ensure-Bw {
    if (-not (Get-Command bw -ErrorAction SilentlyContinue)) {
        throw "bw CLI not found. Install: winget install Bitwarden.CLI"
    }
}

# ---------- mode dispatch ----------------------------------------------------

if ($Status) {
    Ensure-Bw
    $cached = Get-CachedSession
    if (-not $cached) { Write-Host "[status] no cached session"; return }
    if (Test-BwSession -Session $cached) {
        Write-Host "[status] cached session valid (BW unlocked)"
    } else {
        Write-Host "[status] cached session present but expired/invalid"
    }
    return
}

if ($Reset) {
    Remove-CachedSession
    Write-Host "[reset] cleared cached BW_SESSION."
    return
}

if ($Setup) {
    Ensure-Bw
    Write-Host "[setup] verifying Windows Hello..."
    Invoke-Hello -Message "Set up M3E secrets cache"
    Write-Host "[setup] running 'bw unlock' (master password required ONCE)..."
    $session = bw unlock --raw
    if (-not $session) { throw "bw unlock failed" }
    Set-CachedSession -Value $session
    Write-Host "[setup] BW_SESSION cached (DPAPI / CurrentUser). Future runs only need Hello."
    return
}

# ---------- normal Run mode --------------------------------------------------

Ensure-Bw
Invoke-Hello -Message "Unlock M3E secrets"

$session = Get-CachedSession
if (-not (Test-BwSession -Session $session)) {
    Write-Host "[with-keys-bio] cache miss/expired, running bw unlock (master password)..."
    $session = bw unlock --raw
    if (-not $session) { throw "bw unlock failed" }
    Set-CachedSession -Value $session
    $env:BW_SESSION = $session
}

# Fetch keys (env already set wins)
function Set-ApiKey {
    param([string]$Var, [string]$Item)
    if ([Environment]::GetEnvironmentVariable($Var)) { return }
    $val = bw get password $Item --session $session 2>$null
    if ($val) { Set-Item "Env:$Var" $val }
}
Set-ApiKey ANTHROPIC_API_KEY api/anthropic
Set-ApiKey DEEPSEEK_API_KEY  api/deepseek
Set-ApiKey OPENAI_API_KEY    api/openai

if (-not $Command -or $Command.Count -eq 0) {
    Write-Host "[with-keys-bio] no command — loaded:"
    foreach ($v in @("ANTHROPIC_API_KEY","DEEPSEEK_API_KEY","OPENAI_API_KEY")) {
        $set = [Environment]::GetEnvironmentVariable($v)
        Write-Host "  ${v}: $(if ($set) { 'set' } else { 'missing' })"
    }
    return
}

if ($Command[0] -eq "--") { $Command = $Command[1..($Command.Count - 1)] }
& $Command[0] @($Command[1..($Command.Count - 1)])
exit $LASTEXITCODE

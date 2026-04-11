# install/windows/verify-distribution.ps1
# 配布物の一貫検証エントリポイント
# ビルド → テスト → レポート をワンコマンドで実行する
#
# 使い方:
#   powershell -File install\windows\verify-distribution.ps1
#   powershell -File install\windows\verify-distribution.ps1 -SkipCleanup   # テスト後に残す

param(
    [switch]$SkipCleanup
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

Write-Host ""
Write-Host "=========================================="
Write-Host " M3E Distribution Verification Pipeline"
Write-Host " $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "=========================================="

# ── Pre-flight checks ────────────────────────────────────────
Write-Host ""
Write-Host "[Pre-flight] Checking prerequisites..."

# Inno Setup
$iscc = Get-Command iscc -ErrorAction SilentlyContinue
if (-not $iscc) {
    # Check common install locations
    $commonPaths = @(
        "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
    )
    foreach ($p in $commonPaths) {
        if (Test-Path $p) {
            $env:PATH = "$env:PATH;$(Split-Path $p)"
            $iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
            break
        }
    }
}

if (-not $iscc) {
    Write-Host "[ERROR] Inno Setup (ISCC.exe) not found."
    Write-Host "        Install: winget install JRSoftware.InnoSetup"
    exit 1
}
Write-Host "  Inno Setup: $($iscc.Source)"

# Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
$portableNode = Join-Path $repoRoot "install\node\node.exe"
if (-not $node -and -not (Test-Path $portableNode)) {
    Write-Host "[ERROR] Node.js not found."
    exit 1
}
if ($node) { Write-Host "  Node.js   : $($node.Source)" }
else       { Write-Host "  Node.js   : $portableNode (portable)" }

# Windows edition
$edition = (Get-WmiObject Win32_OperatingSystem).Caption
Write-Host "  OS        : $edition"

$hasSandbox = Test-Path "$env:SystemRoot\System32\WindowsSandbox.exe"
if ($edition -match "Home") {
    Write-Host "  Sandbox   : N/A (Home edition -- using local test)"
} elseif ($hasSandbox) {
    Write-Host "  Sandbox   : Available"
} else {
    Write-Host "  Sandbox   : Not enabled (using local test)"
}

Write-Host ""
Write-Host "  All prerequisites OK."

# ── Run test ─────────────────────────────────────────────────
Write-Host ""

$testScript = Join-Path $PSScriptRoot "run-local-test.ps1"
$extraArgs = @()
if ($SkipCleanup) { $extraArgs += "-SkipCleanup" }

& powershell -NoProfile -ExecutionPolicy Bypass -File $testScript @extraArgs
$exitCode = $LASTEXITCODE

# ── Final summary ────────────────────────────────────────────
Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "[ALL PASS] Distribution verification succeeded."
} else {
    Write-Host "[FAILED] $exitCode test(s) failed. See report above."
}

exit $exitCode

# install/windows/run-local-test.ps1
# Windows Home 対応のインストーラー検証スクリプト
# ビルド → サイレントインストール → ファイル検証 → 起動テスト → アンインストール → クリーンアップ
#
# 使い方:
#   powershell -File install\windows\run-local-test.ps1
#   powershell -File install\windows\run-local-test.ps1 -InstallerPath install\artifacts\M3E-Setup-vMMYYDD.exe
#   powershell -File install\windows\run-local-test.ps1 -SkipBuild        # ビルド済みexeを使う
#   powershell -File install\windows\run-local-test.ps1 -SkipCleanup      # テスト後に残す

param(
    [string]$InstallerPath = "",
    [switch]$SkipBuild,
    [switch]$SkipCleanup
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$artifactsDir = Join-Path $repoRoot "install\artifacts"

$testTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$testDir = Join-Path $env:TEMP "m3e-install-test-$testTimestamp"
$logDir = Join-Path $testDir "logs"
$installDir = Join-Path $testDir "app"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$pass = 0
$fail = 0
$results = @()

function Report([string]$name, [bool]$ok, [string]$detail = "") {
    $script:results += [PSCustomObject]@{ Test = $name; Result = if ($ok) { "PASS" } else { "FAIL" }; Detail = $detail }
    if ($ok) { $script:pass++; Write-Host "  [PASS] $name" }
    else     { $script:fail++; Write-Host "  [FAIL] $name -- $detail" }
}

Write-Host ""
Write-Host "=========================================="
Write-Host " M3E Distribution Verification"
Write-Host " $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "=========================================="
Write-Host ""

# ── Step 0: Build (optional) ─────────────────────────────────
if (-not $SkipBuild -and $InstallerPath -eq "") {
    Write-Host "[0/5] Building installer..."
    $buildScript = Join-Path $PSScriptRoot "build-installer.ps1"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $buildScript 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Report "installer-build" $false "build-installer.ps1 failed (exit $LASTEXITCODE)"
        Write-Host "`n[ABORT] Build failed. Cannot proceed."
        exit 1
    }
    Report "installer-build" $true
}

# ── Resolve installer path ───────────────────────────────────
if ($InstallerPath -eq "") {
    $candidates = Get-ChildItem -Path $artifactsDir -Filter "M3E-Setup-*.exe" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending
    if ($candidates.Count -eq 0) {
        throw "No installer found in $artifactsDir. Run build-installer.ps1 first."
    }
    $InstallerPath = $candidates[0].FullName
}
if (-not (Test-Path $InstallerPath)) {
    throw "Installer not found: $InstallerPath"
}
$InstallerPath = (Resolve-Path $InstallerPath).Path

Write-Host ""
Write-Host "  Installer : $InstallerPath"
Write-Host "  Test dir  : $testDir"
Write-Host ""

# ── Step 1: Silent Install ───────────────────────────────────
Write-Host "[1/5] Installing (silent, to temp dir)..."
$installLog = Join-Path $logDir "inno-install.log"
$proc = Start-Process -FilePath $InstallerPath -ArgumentList @(
    "/VERYSILENT",
    "/SUPPRESSMSGBOXES",
    "/DIR=$installDir",
    "/LOG=$installLog",
    "/NOICONS"
) -Wait -PassThru

Report "silent-install" ($proc.ExitCode -eq 0) "exit code: $($proc.ExitCode)"

# ── Step 2: File Structure ───────────────────────────────────
Write-Host ""
Write-Host "[2/5] Verifying file structure..."

$requiredFiles = @(
    "final\package.json",
    "final\dist\node\start_viewer.js",
    "scripts\final\launch.bat",
    "install\setup.bat"
)

$requiredDirs = @(
    "final\node_modules",
    "final\dist"
)

foreach ($f in $requiredFiles) {
    $p = Join-Path $installDir $f
    Report "file:$f" (Test-Path $p)
}

foreach ($d in $requiredDirs) {
    $p = Join-Path $installDir $d
    Report "dir:$d" (Test-Path $p)
}

# Check node_modules has content (not empty)
$nmDir = Join-Path $installDir "final\node_modules"
if (Test-Path $nmDir) {
    $nmCount = (Get-ChildItem -Path $nmDir -Directory -ErrorAction SilentlyContinue).Count
    Report "node_modules-populated" ($nmCount -gt 10) "found $nmCount packages"
}

# ── Step 3: Config & Data Dir ────────────────────────────────
Write-Host ""
Write-Host "[3/5] Verifying config & data directory..."

$configFile = Join-Path $env:LOCALAPPDATA "M3E\m3e.conf"
Report "config-file" (Test-Path $configFile)

if (Test-Path $configFile) {
    $confContent = Get-Content $configFile -Raw
    Report "config-has-port" ($confContent -match "M3E_PORT=") "should contain M3E_PORT"
    Report "config-has-root" ($confContent -match "M3E_ROOT=") "should contain M3E_ROOT"
}

$dataDir = Join-Path $env:LOCALAPPDATA "M3E"
Report "data-dir-exists" (Test-Path $dataDir)

# ── Step 4: Launch Test ──────────────────────────────────────
Write-Host ""
Write-Host "[4/5] Launch test (start server, check port, stop)..."

$launchBat = Join-Path $installDir "scripts\final\launch.bat"
$serverLog = Join-Path $logDir "launch-test.log"
$port = 38482

# Kill anything already on the port
$ErrorActionPreference = "SilentlyContinue"
$existing = netstat -ano 2>$null | Select-String ":$port" | Select-String "LISTENING"
if ($existing) {
    foreach ($line in $existing) {
        $procId = ($line -split '\s+')[-1]
        if ($procId -ne "0") { taskkill /PID $procId /F 2>$null | Out-Null }
    }
    Start-Sleep -Seconds 2
}
$ErrorActionPreference = "Stop"

# Start server via wrapper script (Start-Process ArgumentList doesn't handle > redirect)
$wrapperBat = Join-Path $logDir "launch-wrapper.bat"
@"
@echo off
cd /d "$installDir"
call "$launchBat" > "$serverLog" 2>&1
"@ | Set-Content -Path $wrapperBat -Encoding ASCII

$serverProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$wrapperBat`"" `
    -WindowStyle Hidden -PassThru

# Wait up to 15s for port to come up
$portUp = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    $check = netstat -ano 2>$null | Select-String ":$port" | Select-String "LISTENING"
    if ($check) { $portUp = $true; break }
    if ($serverProc.HasExited) { break }
}

Report "server-starts" $portUp "port $port listening"

# HTTP health check
if ($portUp) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:$port/" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        Report "http-responds" ($resp.StatusCode -eq 200) "status: $($resp.StatusCode)"
    } catch {
        Report "http-responds" $false $_.Exception.Message
    }
}

# Stop server — suppress errors from already-exited processes
$ErrorActionPreference = "SilentlyContinue"
$listeners = netstat -ano 2>$null | Select-String ":$port" | Select-String "LISTENING"
foreach ($line in $listeners) {
    $procId = ($line -split '\s+')[-1]
    if ($procId -ne "0") { taskkill /PID $procId /F 2>$null | Out-Null }
}
if (-not $serverProc.HasExited) {
    try { $serverProc.Kill() } catch {}
}
$ErrorActionPreference = "Stop"
Start-Sleep -Seconds 1

# ── Step 5: Uninstall ────────────────────────────────────────
Write-Host ""
Write-Host "[5/5] Uninstall test..."

$uninstaller = Join-Path $installDir "unins000.exe"
if (Test-Path $uninstaller) {
    $unProc = Start-Process -FilePath $uninstaller -ArgumentList "/VERYSILENT","/SUPPRESSMSGBOXES" -Wait -PassThru
    Start-Sleep -Seconds 2
    $appGone = -not (Test-Path (Join-Path $installDir "final\package.json"))
    Report "uninstall-runs" ($unProc.ExitCode -eq 0) "exit code: $($unProc.ExitCode)"
    Report "uninstall-removes-files" $appGone
} else {
    Report "uninstaller-exists" $false "unins000.exe not found"
}

# ── Cleanup ──────────────────────────────────────────────────
if (-not $SkipCleanup) {
    Start-Sleep -Seconds 1
    Remove-Item -Recurse -Force $testDir -ErrorAction SilentlyContinue
}

# ── Report ───────────────────────────────────────────────────
Write-Host ""
Write-Host "=========================================="
Write-Host " Results: $pass PASS / $fail FAIL"
Write-Host "=========================================="

if ($fail -gt 0) {
    Write-Host ""
    Write-Host " Failed tests:"
    $results | Where-Object { $_.Result -eq "FAIL" } | ForEach-Object {
        Write-Host "   - $($_.Test): $($_.Detail)"
    }
}

# Write results to JSON for CI consumption
$reportFile = Join-Path $repoRoot "artifacts\test-report-$testTimestamp.json"
$reportDir = Split-Path $reportFile
if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir -Force | Out-Null }
$results | ConvertTo-Json -Depth 3 | Set-Content -Path $reportFile -Encoding UTF8
Write-Host ""
Write-Host "  Report: $reportFile"

if ($SkipCleanup) {
    Write-Host "  Test dir preserved: $testDir"
}

Write-Host ""
exit $fail

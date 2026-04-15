# M3E data residual cleanup
# Live workspace: %LOCALAPPDATA%\M3E\workspaces\ws_REMH1Z5TFA7S93R3HA0XK58JNR
# Goal: keep only the live data.sqlite + 1 newest auto-backup. Remove everything else.

$ErrorActionPreference = 'Continue'
$base = "$env:LOCALAPPDATA\M3E"
$ws   = "$base\workspaces\ws_REMH1Z5TFA7S93R3HA0XK58JNR"

$targets = @(
    "$ws\data.sqlite.bak-20260415-112313",
    "$base\workspaces\.m3e-launched",
    "$base\workspaces\audit",
    "$base\workspaces\backups",
    "$base\backups\M3E_dataV1_20260413_105430.sqlite",
    "$base\workspaces\main",
    "$base\workspaces\sandbox",
    "$base\workspaces\ws_A98E70JM9GAXCVXVMQBW7N0YGZ",
    "$base\workspaces\data.sqlite"
)

foreach ($t in $targets) {
    if (Test-Path -LiteralPath $t) {
        Remove-Item -LiteralPath $t -Recurse -Force
        Write-Host "removed: $t"
    } else {
        Write-Host "skip (not found): $t"
    }
}

Get-ChildItem "$env:LOCALAPPDATA\Temp" -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'm3e-backup-test-*' -or $_.Name -like 'm3e-backup-api-*' } |
    ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Recurse -Force
        Write-Host "removed: $($_.FullName)"
    }

Write-Host ""
Write-Host "=== final state ==="
Get-ChildItem "$base\workspaces\" -Force | Format-Table Mode,LastWriteTime,Length,Name
Write-Host "--- ws_REM ---"
Get-ChildItem $ws -Force | Format-Table Mode,LastWriteTime,Length,Name
Write-Host "--- ws_REM\backups ---"
Get-ChildItem "$ws\backups" -Force | Format-Table Mode,LastWriteTime,Length,Name

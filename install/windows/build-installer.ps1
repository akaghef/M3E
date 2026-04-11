param(
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$issPath = Join-Path $PSScriptRoot "m3e.iss"

if (-not (Test-Path $issPath)) {
    throw "m3e.iss not found: $issPath"
}

$iscc = Get-Command iscc -ErrorAction SilentlyContinue
if (-not $iscc) {
    throw "Inno Setup Compiler (iscc) is not found in PATH."
}

$tempIss = $issPath
if ($Version -ne "") {
    $content = Get-Content -Path $issPath -Raw
    $content = $content -replace '#define AppVersion "vMMYYDD"', ('#define AppVersion "{0}"' -f $Version)
    $tempIss = Join-Path $env:TEMP "m3e_$($Version)_tmp.iss"
    Set-Content -Path $tempIss -Value $content -Encoding UTF8
}

Write-Host "Building installer from: $tempIss"
Push-Location $repoRoot
try {
    & $iscc.Source $tempIss
} finally {
    Pop-Location
    if ($tempIss -ne $issPath -and (Test-Path $tempIss)) {
        Remove-Item $tempIss -Force
    }
}

Write-Host "Installer build finished."

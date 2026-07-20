$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$artifactDir = Join-Path $repoRoot "artifacts"
$vsixPath = Join-Path $artifactDir "m3e-sidebar.vsix"

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

Push-Location $scriptDir
try {
  npx @vscode/vsce package --allow-missing-repository --out $vsixPath
  & code.cmd "--install-extension" "$vsixPath" "--force"
  Write-Host "Installed: $vsixPath"
} finally {
  Pop-Location
}

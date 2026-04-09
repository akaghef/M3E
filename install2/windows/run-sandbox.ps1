param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $InstallerPath)) {
    throw "Installer not found: $InstallerPath"
}

$installerFullPath = (Resolve-Path $InstallerPath).Path
$installerDir = Split-Path -Parent $installerFullPath
$installerName = Split-Path -Leaf $installerFullPath

$hostLogDir = Join-Path $installerDir "sandbox-logs"
New-Item -ItemType Directory -Path $hostLogDir -Force | Out-Null

$sandboxWork = Join-Path $env:TEMP "m3e-sandbox"
New-Item -ItemType Directory -Path $sandboxWork -Force | Out-Null

$commandPs1 = Join-Path $sandboxWork "sandbox-command.ps1"
@"
`$ErrorActionPreference = 'Stop'
`$mapped = 'C:\Installer'
`$installer = Join-Path `$mapped '$installerName'
`$logDir = Join-Path `$mapped 'sandbox-logs'
New-Item -ItemType Directory -Path `$logDir -Force | Out-Null

Start-Process -FilePath `$installer -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/LOG=' + (Join-Path `$logDir 'install.log') -Wait
"@ | Set-Content -Path $commandPs1 -Encoding UTF8

$wsbPath = Join-Path $sandboxWork "m3e-install-check.wsb"
@"
<Configuration>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>$installerDir</HostFolder>
      <SandboxFolder>C:\Installer</SandboxFolder>
      <ReadOnly>false</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>powershell -NoProfile -ExecutionPolicy Bypass -File C:\Installer\$(Split-Path -Leaf $commandPs1)</Command>
  </LogonCommand>
</Configuration>
"@ | Set-Content -Path $wsbPath -Encoding UTF8

Copy-Item -Path $commandPs1 -Destination (Join-Path $installerDir (Split-Path -Leaf $commandPs1)) -Force

Write-Host "Launching Windows Sandbox with:"
Write-Host "  $wsbPath"
Start-Process -FilePath $wsbPath
Write-Host "Sandbox started. Close Sandbox after install to finish."

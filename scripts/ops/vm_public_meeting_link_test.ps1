$ErrorActionPreference = "Stop"

$vmName = "M3E-Test"
$guestUser = "m3etest"
$guestPass = "m3etest"
$publicBase = "https://akaghef-dell.tail6206ae.ts.net"
$workspaceId = "ws_team_swingby"
$mapId = "map_team_swingby_monthly_2604"
$vbox = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"

if (-not (Test-Path $vbox)) {
  throw "VBoxManage not found at $vbox"
}

$viewerUrl = "$publicBase/viewer.html?ws=$workspaceId&map=$mapId&access=view"
$apiUrl = "$publicBase/api/maps/$mapId"

Write-Output "============================================================"
Write-Output " M3E Public Meeting Link VM Test"
Write-Output " VM: $vmName"
Write-Output " URL: $viewerUrl"
Write-Output "============================================================"

$guestScript = @"
`$ErrorActionPreference = "Stop"
`$ProgressPreference = "SilentlyContinue"
`$viewer = Invoke-WebRequest -UseBasicParsing -Uri "$viewerUrl" -TimeoutSec 30
`$api = Invoke-WebRequest -UseBasicParsing -Uri "$apiUrl" -TimeoutSec 30
`$json = `$api.Content | ConvertFrom-Json
`$root = `$json.state.nodes.(`$json.state.rootId).text
`$nodeProps = @(`$json.state.nodes.PSObject.Properties)
`$rootCodes = (`$root.ToCharArray() | ForEach-Object { [int][char]`$_ }) -join ","
`$april = @(`$nodeProps | Where-Object { ((`$_.Value.text.ToCharArray() | ForEach-Object { [int][char]`$_ }) -join ",") -eq "52,26376" })
Write-Output ("VIEWER_STATUS=" + `$viewer.StatusCode)
Write-Output ("API_STATUS=" + `$api.StatusCode)
Write-Output ("ROOT_CODES=" + `$rootCodes)
Write-Output ("APRIL_MATCH_COUNT=" + `$april.Count)
Write-Output ("NODE_COUNT=" + `$nodeProps.Count)
if (`$viewer.StatusCode -ne 200 -or `$api.StatusCode -ne 200 -or `$rootCodes -ne "23450,20363,20250" -or `$april.Count -lt 1 -or `$nodeProps.Count -lt 80) {
  exit 2
}
"@

$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($guestScript))
& $vbox guestcontrol $vmName run `
  --username $guestUser `
  --password $guestPass `
  --exe "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
  --timeout 60000 `
  --wait-stdout `
  -- -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded

if ($LASTEXITCODE -ne 0) {
  throw "Public meeting link VM test failed with exit code $LASTEXITCODE"
}

Write-Output "[PASS] Public meeting link works from VM."

param(
  [string]$VmName = "M3E-Test",
  [string]$GuestUser = "m3etest",
  [string]$GuestPass = "m3etest",
  [string]$PublicBase = "https://akaghef-dell.tail6206ae.ts.net",
  [string]$WorkspaceId = "ws_team_swingby",
  [string]$MapId = "map_team_swingby_conflict_lab_260502",
  [switch]$KeepGuestFiles
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$VBoxManage = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
if (-not (Test-Path $VBoxManage)) {
  throw "VBoxManage not found at $VBoxManage"
}

$ApiUrl = "$PublicBase/api/maps/$MapId"
$ViewerUrl = "$PublicBase/viewer.html?ws=$WorkspaceId&map=$MapId&access=edit"
$RunId = Get-Date -Format "yyyyMMdd_HHmmss"
$GuestDir = "C:\M3E_test_reports\swingby_conflict_lab_$RunId"
$GuestStalePath = "$GuestDir\stale.json"
$GuestReportPath = "$GuestDir\report.txt"

function New-LabNode {
  param(
    [string]$Id,
    $ParentId,
    [string]$Text
  )
  [ordered]@{
    id = $Id
    parentId = $ParentId
    children = @()
    nodeType = "text"
    text = $Text
    collapsed = $false
    details = ""
    note = ""
    attributes = @{}
    link = ""
  }
}

function New-LabState {
  param([string]$RunId)
  $rootId = "root"
  $hostSeedId = "host_seed_$RunId"
  $nodes = [ordered]@{}
  $nodes[$rootId] = New-LabNode -Id $rootId -ParentId $null -Text "Swingby conflict lab"
  $nodes[$hostSeedId] = New-LabNode -Id $hostSeedId -ParentId $rootId -Text "host seed $RunId"
  $nodes[$rootId].children = @($hostSeedId)
  [ordered]@{
    rootId = $rootId
    nodes = $nodes
  }
}

function Add-LabChild {
  param(
    [Parameter(Mandatory = $true)]$State,
    [string]$Id,
    [string]$Text
  )
  $rootId = [string]$State.rootId
  $node = [pscustomobject](New-LabNode -Id $Id -ParentId $rootId -Text $Text)
  $State.nodes | Add-Member -NotePropertyName $Id -NotePropertyValue $node -Force
  $State.nodes.$rootId.children = @($State.nodes.$rootId.children) + $Id
  return $State
}

function Invoke-Json {
  param(
    [string]$Uri,
    [string]$Method = "GET",
    $Body = $null
  )
  $headers = @{ "Content-Type" = "application/json; charset=utf-8" }
  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -TimeoutSec 30 -Headers $headers
  }
  return Invoke-RestMethod -Method $Method -Uri $Uri -TimeoutSec 30 -Headers $headers -Body (($Body | ConvertTo-Json -Depth 100))
}

function Invoke-GuestPowerShell {
  param([string]$Script)
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Script))
  & $VBoxManage guestcontrol $VmName run `
    --username $GuestUser `
    --password $GuestPass `
    --exe "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
    --timeout 120000 `
    --wait-stdout `
    --wait-stderr `
    -- -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded
  if ($LASTEXITCODE -ne 0) {
    throw "Guest PowerShell failed with exit code $LASTEXITCODE"
  }
}

Write-Output "============================================================"
Write-Output " M3E Swingby Conflict Lab VM/Public-Link Test"
Write-Output " VM: $VmName"
Write-Output " Workspace: $WorkspaceId"
Write-Output " Map: $MapId"
Write-Output " Viewer: $ViewerUrl"
Write-Output " API: $ApiUrl"
Write-Output "============================================================"

Write-Output "[1/6] Checking public API from host..."
$health = Invoke-WebRequest -UseBasicParsing -Uri $ViewerUrl -TimeoutSec 30
if ($health.StatusCode -lt 200 -or $health.StatusCode -ge 500) {
  throw "Public viewer returned HTTP $($health.StatusCode): $ViewerUrl"
}

Write-Output "[2/6] Host seeds conflict lab map..."
$seedState = New-LabState -RunId $RunId
$seed = Invoke-Json -Method "POST" -Uri $ApiUrl -Body @{ state = $seedState; force = $true }
if (-not $seed.ok) {
  throw "Host seed failed."
}
$seedSavedAt = [string]$seed.savedAt
Write-Output "      Seed savedAt=$seedSavedAt"

Write-Output "[3/6] VM reads stale base through public URL..."
$guestRead = @"
`$ErrorActionPreference = "Stop"
`$ProgressPreference = "SilentlyContinue"
New-Item -ItemType Directory -Force -Path "$GuestDir" | Out-Null
`$raw = Invoke-WebRequest -UseBasicParsing -Method GET -Uri "$ApiUrl" -TimeoutSec 30
Set-Content -Encoding UTF8 -Path "$GuestStalePath" -Value `$raw.Content
`$api = `$raw.Content | ConvertFrom-Json
"STALE_SAVED_AT=`$(`$api.savedAt)" | Tee-Object -FilePath "$GuestReportPath"
"STALE_ROOT=`$(`$api.state.nodes.(`$api.state.rootId).text)" | Add-Content -Encoding UTF8 "$GuestReportPath"
"STALE_NODE_COUNT=`$(@(`$api.state.nodes.PSObject.Properties).Count)" | Add-Content -Encoding UTF8 "$GuestReportPath"
"@
Invoke-GuestPowerShell -Script $guestRead

Write-Output "[4/6] Host saves newer edit from the stale base..."
$hostCurrent = Invoke-Json -Uri $ApiUrl
$hostState = Add-LabChild -State $hostCurrent.state -Id "host_newer_$RunId" -Text "host newer edit $RunId"
$hostSave = Invoke-Json -Method "POST" -Uri $ApiUrl -Body @{ state = $hostState; baseSavedAt = $seedSavedAt }
if (-not $hostSave.ok) {
  throw "Host newer edit failed."
}
$hostSavedAt = [string]$hostSave.savedAt
Write-Output "      Host newer savedAt=$hostSavedAt"

Write-Output "[5/6] VM attempts stale save, expects 409, then force-saves merged resolution..."
$guestConflict = @"
`$ErrorActionPreference = "Stop"
`$ProgressPreference = "SilentlyContinue"
function New-LabNode([string]`$Id, [string]`$ParentId, [string]`$Text) {
  [pscustomobject]@{
    id = `$Id
    parentId = `$ParentId
    children = @()
    nodeType = "text"
    text = `$Text
    collapsed = `$false
    details = ""
    note = ""
    attributes = @{}
    link = ""
  }
}
function Add-LabChild(`$State, [string]`$Id, [string]`$Text) {
  `$rootId = [string]`$State.rootId
  `$node = New-LabNode -Id `$Id -ParentId `$rootId -Text `$Text
  `$State.nodes | Add-Member -NotePropertyName `$Id -NotePropertyValue `$node -Force
  `$State.nodes.`$rootId.children = @(`$State.nodes.`$rootId.children) + `$Id
  return `$State
}
function Post-Lab(`$Body) {
  `$json = `$Body | ConvertTo-Json -Depth 100
  try {
    `$response = Invoke-WebRequest -Method POST -Uri "$ApiUrl" -Headers @{ "Content-Type" = "application/json; charset=utf-8" } -Body `$json -TimeoutSec 30 -UseBasicParsing
    return [pscustomobject]@{ StatusCode = `$response.StatusCode; Json = (`$response.Content | ConvertFrom-Json) }
  } catch {
    if (`$_.Exception.Response) {
      `$status = [int]`$_.Exception.Response.StatusCode
      `$reader = New-Object System.IO.StreamReader(`$_.Exception.Response.GetResponseStream())
      `$content = `$reader.ReadToEnd()
      return [pscustomobject]@{ StatusCode = `$status; Json = (`$content | ConvertFrom-Json) }
    }
    throw
  }
}
`$stale = Get-Content "$GuestStalePath" -Raw | ConvertFrom-Json
`$staleState = Add-LabChild -State `$stale.state -Id "vm_stale_$RunId" -Text "vm stale edit $RunId"
`$staleSave = Post-Lab @{ state = `$staleState; baseSavedAt = `$stale.savedAt }
"STALE_POST_STATUS=`$(`$staleSave.StatusCode)" | Add-Content -Encoding UTF8 "$GuestReportPath"
if (`$staleSave.StatusCode -ne 409) {
  "FAIL expected 409" | Add-Content -Encoding UTF8 "$GuestReportPath"
  exit 2
}
`$latest = Invoke-RestMethod -Method GET -Uri "$ApiUrl" -TimeoutSec 30
`$remoteState = `$latest.state
`$mergedState = Add-LabChild -State `$remoteState -Id "vm_resolution_$RunId" -Text "vm resolution edit $RunId"
`$resolved = Post-Lab @{ state = `$mergedState; baseSavedAt = `$stale.savedAt; force = `$true }
"RESOLVE_POST_STATUS=`$(`$resolved.StatusCode)" | Add-Content -Encoding UTF8 "$GuestReportPath"
"RESOLVE_SAVED_AT=`$(`$resolved.Json.savedAt)" | Add-Content -Encoding UTF8 "$GuestReportPath"
if (`$resolved.StatusCode -ne 200 -or -not `$resolved.Json.ok) {
  "FAIL force resolution failed" | Add-Content -Encoding UTF8 "$GuestReportPath"
  exit 3
}
"PASS stale conflict and force resolution completed" | Add-Content -Encoding UTF8 "$GuestReportPath"
"@
Invoke-GuestPowerShell -Script $guestConflict

Write-Output "[6/6] Host verifies final state contains host and VM resolution content..."
$final = Invoke-Json -Uri $ApiUrl
$labels = @($final.state.nodes.PSObject.Properties | ForEach-Object { [string]$_.Value.text })
$required = @(
  "Swingby conflict lab",
  "host seed $RunId",
  "host newer edit $RunId",
  "vm resolution edit $RunId"
)
foreach ($label in $required) {
  if ($labels -notcontains $label) {
    throw "Final state is missing required label: $label"
  }
}
if ($labels -contains "vm stale edit $RunId") {
  Write-Output "      VM stale-only label is present; resolution retained it."
} else {
  Write-Output "      VM stale-only label is absent; explicit resolution label is present."
}

Write-Output ""
Write-Output "[PASS] Swingby conflict lab verified."
Write-Output "       Viewer: $ViewerUrl"
Write-Output "       Guest report: $GuestReportPath"
Write-Output "       Final savedAt: $($final.savedAt)"

if (-not $KeepGuestFiles) {
  Write-Output "       Guest files kept for inspection in shared reports; pass -KeepGuestFiles is not required for report retention."
}

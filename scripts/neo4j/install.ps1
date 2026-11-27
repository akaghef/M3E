# Per-user Neo4j for M3E on Windows (no admin). Idempotent: a rerun on an installed state
# changes nothing and says so. Versions come from scripts/neo4j/versions.env.
#
# Layout under <M3E home>\neo4j (M3E home defaults to %LOCALAPPDATA%\M3E):
#   downloads\                 verified archives (Neo4j zip, Temurin JRE zip)
#   dist\neo4j-community-<v>\  the Neo4j distribution, never edited
#   dist\temurin-jre-<v>\      the Java runtime
#   instances\main\            real data: bolt 127.0.0.1:7687, auth on, HTTP 127.0.0.1:7474
#   instances\test\            disposable test data: bolt 127.0.0.1:7688, auth off, no HTTP
# The main instance's password is generated once into <M3E home>\secrets\neo4j-password (user-only
# ACL) and never printed. Each instance has a watchdog start.cmd, started at logon by a Startup
# entry M3E-<label>.vbs and, when not running, right away (as a process outside this session).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\neo4j\install.ps1 [-Instances main,test]
param(
  [string]$M3eHome = $(if ($env:M3E_HOME) { $env:M3E_HOME } else { Join-Path $env:LOCALAPPDATA 'M3E' }),
  [string[]]$Instances = @('main', 'test'),
  [int]$MainPort = 7687,
  [int]$MainHttpPort = 7474,
  [int]$TestPort = 7688,
  [string]$LabelSuffix = ''
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Instances = @($Instances | ForEach-Object { $_ -split ',' } | Where-Object { $_ })

$versions = @{}
Get-Content (Join-Path $PSScriptRoot 'versions.env') | Where-Object { $_ -match '^([A-Z0-9_]+)=(.+)$' } | ForEach-Object { $versions[$Matches[1]] = $Matches[2].Trim() }
$neo4jVersion = $versions['NEO4J_VERSION']; $temurinRelease = $versions['TEMURIN_RELEASE']
if (-not $neo4jVersion -or -not $temurinRelease) { throw 'versions.env is incomplete' }

$root = Join-Path $M3eHome 'neo4j'
$downloads = Join-Path $root 'downloads'
$dist = Join-Path $root 'dist'
$secrets = Join-Path $M3eHome 'secrets'
$passwordFile = Join-Path $secrets 'neo4j-password'
$neo4jHome = Join-Path $dist "neo4j-community-$neo4jVersion"
$temurinFileVersion = ($temurinRelease -replace '^jdk-', '') -replace '\+', '_'
$temurinMajor = $temurinFileVersion.Split('.')[0]
$jreDir = Join-Path $dist "temurin-jre-$temurinFileVersion"
$startup = [Environment]::GetFolderPath('Startup')
$script:changes = 0

function Log($m) { Write-Output "[neo4j-install] $m" }
function Changed($m) { $script:changes++; Log "changed: $m" }
function Unchanged($m) { Log "ok: $m" }

function Get-Sha256Text($url) {
  # GitHub serves release assets as application/octet-stream, so Content can be a byte array.
  $c = (Invoke-WebRequest -UseBasicParsing $url).Content
  if ($c -is [byte[]]) { $c = [Text.Encoding]::ASCII.GetString($c) }
  return "$c".Trim().Split()[0].ToLower()
}

function Fetch-Verified($url, $out, $sha) {
  if ((Test-Path $out) -and ((Get-FileHash $out -Algorithm SHA256).Hash.ToLower() -eq $sha)) { Unchanged "download $(Split-Path $out -Leaf)"; return }
  $tmp = "$out.part"
  Invoke-WebRequest -UseBasicParsing $url -OutFile $tmp
  if ((Get-FileHash $tmp -Algorithm SHA256).Hash.ToLower() -ne $sha) { Remove-Item $tmp -Force; throw "checksum mismatch for $url" }
  Move-Item -Force $tmp $out
  Changed "downloaded $(Split-Path $out -Leaf)"
}

function Extract-Once($archive, $dest) {
  if (Test-Path $dest) { Unchanged "$(Split-Path $dest -Leaf) present"; return }
  $tmp = Join-Path $dist ('.extract-' + [guid]::NewGuid().ToString('N'))
  Expand-Archive $archive $tmp
  Move-Item (Get-ChildItem $tmp -Directory)[0].FullName $dest
  Remove-Item -Recurse -Force $tmp
  Changed "extracted $(Split-Path $dest -Leaf)"
}

# Writes $content (CRLF lines) to $file only when it differs. Returns $true when it wrote.
function Write-IfChanged($file, [string]$content) {
  $content = ($content -replace "`r?`n", "`r`n").TrimEnd() + "`r`n"
  if ((Test-Path $file) -and ([IO.File]::ReadAllText($file) -eq $content)) { return $false }
  [IO.File]::WriteAllText($file, $content, (New-Object Text.ASCIIEncoding))
  return $true
}

function Set-UserOnlyAcl($path, [switch]$Container) {
  $grant = if ($Container) { "$($env:USERNAME):(OI)(CI)F" } else { "$($env:USERNAME):F" }
  icacls $path /inheritance:r /grant:r $grant | Out-Null
}

function Test-Port($port) { [bool](Get-NetTCPConnection -State Listen -LocalAddress 127.0.0.1 -LocalPort $port -ErrorAction SilentlyContinue) }

function Invoke-Cypher($port, $user, $password, $statement, $database) {
  $cargs = @('-a', "bolt://127.0.0.1:$port", '--format', 'plain')
  if ($user) { $cargs += @('-u', $user) }
  if ($database) { $cargs += @('-d', $database) }
  $env:JAVA_HOME = $jreDir
  # cypher-shell.bat runs the java on PATH, not the one in JAVA_HOME.
  if (-not $env:PATH.StartsWith("$jreDir\bin;")) { $env:PATH = "$jreDir\bin;$env:PATH" }
  if ($user) { $env:NEO4J_PASSWORD = $password } else { Remove-Item Env:NEO4J_PASSWORD -ErrorAction SilentlyContinue }
  # The statement goes in a file (UTF-8 without BOM) in the user-only secrets directory: piped stdin
  # reaches cypher-shell with a BOM, and an argument would put a password in the process list.
  $dir = if (Test-Path $secrets) { $secrets } else { $env:TEMP }
  $file = Join-Path $dir ('.cypher-' + [guid]::NewGuid().ToString('N') + '.cypher')
  [IO.File]::WriteAllText($file, $statement, (New-Object Text.UTF8Encoding $false))
  try {
    # Windows PowerShell turns native stderr into errors; a refused login is an answer here, not a failure.
    $ErrorActionPreference = 'Continue'
    & "$neo4jHome\bin\cypher-shell.bat" @cargs -f $file 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
  } finally {
    Remove-Item $file -Force -ErrorAction SilentlyContinue
    Remove-Item Env:NEO4J_PASSWORD -ErrorAction SilentlyContinue
  }
}

foreach ($d in $M3eHome, $root, $downloads, $dist) { New-Item -ItemType Directory -Force $d | Out-Null }

# Neo4j distribution
$neo4jUrl = "https://dist.neo4j.org/neo4j-community-$neo4jVersion-windows.zip"
$neo4jZip = Join-Path $downloads "neo4j-community-$neo4jVersion-windows.zip"
if (-not (Test-Path $neo4jHome)) { Fetch-Verified $neo4jUrl $neo4jZip (Get-Sha256Text "$neo4jUrl.sha256") }
Extract-Once $neo4jZip $neo4jHome

# Java runtime
$jreName = "OpenJDK${temurinMajor}U-jre_x64_windows_hotspot_${temurinFileVersion}.zip"
$jreUrl = "https://github.com/adoptium/temurin$temurinMajor-binaries/releases/download/$($temurinRelease -replace '\+', '%2B')/$jreName"
if (-not (Test-Path $jreDir)) { Fetch-Verified $jreUrl (Join-Path $downloads $jreName) (Get-Sha256Text "$jreUrl.sha256.txt") }
Extract-Once (Join-Path $downloads $jreName) $jreDir
if (-not (Test-Path "$jreDir\bin\java.exe")) { throw "no java in $jreDir" }

# Password of the main instance: generated once, never printed, never replaced.
if ($Instances -contains 'main') {
  New-Item -ItemType Directory -Force $secrets | Out-Null
  Set-UserOnlyAcl $secrets -Container
  if ((Test-Path $passwordFile) -and (Get-Item $passwordFile).Length -gt 0) { Unchanged 'password file present' }
  else {
    $b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    [IO.File]::WriteAllText($passwordFile, (($b | ForEach-Object { $_.ToString('x2') }) -join ''))
    Changed 'generated the password file'
  }
  Set-UserOnlyAcl $passwordFile
}

function Setup-Instance($name, $port, $httpPort, $auth, $heap, $pagecache, $label) {
  $dir = Join-Path $root "instances\$name"
  foreach ($d in 'conf', 'data', 'logs', 'run', 'import', 'plugins') { New-Item -ItemType Directory -Force (Join-Path $dir $d) | Out-Null }
  $conf = Join-Path $dir 'conf'
  $fwd = $dir -replace '\\', '/'
  $http = if ($httpPort) { "server.http.enabled=true`nserver.http.listen_address=127.0.0.1:$httpPort`nserver.http.advertised_address=127.0.0.1:$httpPort" } else { 'server.http.enabled=false' }
  $jvm = (Get-Content (Join-Path $neo4jHome 'conf\neo4j.conf') | Where-Object { $_ -match '^server.jvm.additional=' }) -join "`n"
  $content = @"
# Generated by scripts/neo4j/install.ps1 (Neo4j $neo4jVersion). Rerun the script instead of editing.
server.directories.data=$fwd/data
server.directories.logs=$fwd/logs
server.directories.run=$fwd/run
server.directories.import=$fwd/import
server.directories.plugins=$fwd/plugins
server.default_listen_address=127.0.0.1
server.bolt.listen_address=127.0.0.1:$port
server.bolt.advertised_address=127.0.0.1:$port
$http
server.https.enabled=false
dbms.security.auth_enabled=$auth
dbms.usage_report.enabled=false
server.fleet_discovery.enabled=false
server.memory.heap.initial_size=$heap
server.memory.heap.max_size=$heap
server.memory.pagecache.size=$pagecache
$jvm
"@
  $restart = $false
  if (Write-IfChanged (Join-Path $conf 'neo4j.conf') $content) { Changed "${name}: neo4j.conf"; $restart = $true } else { Unchanged "${name}: neo4j.conf" }
  foreach ($f in 'server-logs.xml', 'user-logs.xml', 'neo4j-admin.conf') {
    if (Write-IfChanged (Join-Path $conf $f) ([IO.File]::ReadAllText((Join-Path $neo4jHome "conf\$f")))) { Changed "${name}: $f"; $restart = $true } else { Unchanged "${name}: $f" }
  }

  # Watchdog: while the port listens it checks every 30 s; otherwise it starts Neo4j and, when
  # Neo4j exits, starts it again after 10 s.
  $startCmd = Join-Path $dir 'start.cmd'
  $cmd = @"
@echo off
REM Generated by scripts/neo4j/install.ps1: Neo4j instance '$name' (bolt 127.0.0.1:$port).
set "JAVA_HOME=$jreDir"
set "NEO4J_HOME=$neo4jHome"
set "NEO4J_CONF=$conf"
:loop
netstat -ano | findstr /R /C:"127.0.0.1:$port .*LISTENING" >nul && (timeout /t 30 /nobreak >nul & goto loop)
echo [%DATE% %TIME%] starting neo4j >> "$dir\logs\console.log"
call "%NEO4J_HOME%\bin\neo4j.bat" console >> "$dir\logs\console.log" 2>&1
timeout /t 10 /nobreak >nul
goto loop
"@
  if (Write-IfChanged $startCmd $cmd) { Changed "${name}: start.cmd" } else { Unchanged "${name}: start.cmd" }
  $vbs = Join-Path $startup "M3E-$label.vbs"
  $vbsText = "CreateObject(""WScript.Shell"").Run ""cmd /c """"$startCmd"""""", 0, False"
  if (Write-IfChanged $vbs $vbsText) { Changed "${name}: Startup entry $(Split-Path $vbs -Leaf)" } else { Unchanged "${name}: Startup entry $(Split-Path $vbs -Leaf)" }

  $java = @(Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object { $_.CommandLine -like "*$neo4jHome*" -and $_.CommandLine -like "*$conf*" })
  $watchdogs = @(Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" | Where-Object { $_.CommandLine -like "*$startCmd*" })
  if ($restart -and $java.Count -gt 0) {
    $java | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    for ($i = 0; $i -lt 30 -and (Test-Port $port); $i++) { Start-Sleep 1 }
    Changed "${name}: restarted for the new configuration"
  }
  if ($watchdogs.Count -eq 0) {
    if ((Test-Port $port) -and $java.Count -eq 0) { throw "port $port is already taken by a process that is not instance '$name'; stop it first." }
    # A process of its own, so that it outlives this (possibly remote) session.
    $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = "cmd /c `"$startCmd`"" }
    if ($r.ReturnValue -ne 0) { throw "could not start $startCmd" }
    Changed "${name}: started the watchdog"
  } else { Unchanged "${name}: watchdog running" }
  for ($i = 0; $i -lt 90 -and -not (Test-Port $port); $i++) { Start-Sleep 2 }
  if (-not (Test-Port $port)) { throw "${name}: bolt 127.0.0.1:$port did not open; see $dir\logs" }

  if ($auth -eq 'true') {
    $password = [IO.File]::ReadAllText($passwordFile).Trim()
    if (Invoke-Cypher $port 'neo4j' $password 'RETURN 1;') { Unchanged "${name}: neo4j logs in with the password file" }
    else {
      # First start: the default password must be changed before anything else is allowed.
      for ($i = 0; $i -lt 15; $i++) {
        if (Invoke-Cypher $port 'neo4j' 'neo4j' "ALTER CURRENT USER SET PASSWORD FROM 'neo4j' TO '$password';" 'system') { break }
        Start-Sleep 2
      }
      if (-not (Invoke-Cypher $port 'neo4j' $password 'RETURN 1;')) { throw "${name}: cannot log in with the password file and the default password was not accepted." }
      Changed "${name}: set the password from the password file"
    }
  } else {
    if (-not (Invoke-Cypher $port '' '' 'RETURN 1;')) { throw "${name}: RETURN 1 failed on $port" }
    Unchanged "${name}: answers without auth"
  }
}

foreach ($instance in $Instances) {
  switch ($instance) {
    'main' { Setup-Instance 'main' $MainPort $MainHttpPort 'true' '512m' '256m' "neo4j$LabelSuffix" }
    'test' { Setup-Instance 'test' $TestPort $null 'false' '512m' '128m' "neo4j-test$LabelSuffix" }
    default { throw "unknown instance: $instance" }
  }
}
if ($script:changes -eq 0) { Log "no changes: Neo4j $neo4jVersion already installed and running ($($Instances -join ','))" }
else { Log "$($script:changes) change(s) applied" }

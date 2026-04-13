param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('visual','data','data2','team','manage')]
    [string]$Role
)

$ErrorActionPreference = 'Stop'

$roleMap = @{
    visual = @{
        branch = 'dev-visual'
        worktree = 'C:/Users/Akaghef/dev/M3E-dev-visual'
        needsSync = $true
    }
    data = @{
        branch = 'dev-data'
        worktree = 'C:/Users/Akaghef/dev/M3E'
        needsSync = $true
    }
    data2 = @{
        branch = 'dev-data2'
        worktree = 'C:/Users/Akaghef/dev/M3E-dev-data2'
        needsSync = $true
    }
    team = @{
        branch = 'dev-team'
        worktree = 'C:/Users/Akaghef/dev/M3E-dev-team'
        needsSync = $true
    }
    manage = @{
        branch = 'dev-beta'
        worktree = 'C:/Users/Akaghef/dev/M3E'
        needsSync = $false
    }
}

$target = $roleMap[$Role]

if (-not (Test-Path $target.worktree)) {
    throw "Expected worktree not found: $($target.worktree)"
}

Set-Location $target.worktree

$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $target.branch) {
    git checkout $target.branch
    $currentBranch = (git branch --show-current).Trim()
}

if ($currentBranch -ne $target.branch) {
    throw "Branch alignment failed. expected=$($target.branch) actual=$currentBranch"
}

$syncResult = 'skipped'
if ($target.needsSync) {
    git fetch origin
    git reset --hard origin/dev-beta
    $syncResult = 'pass'
}

Write-Host "role=$Role"
Write-Host "worktree=$($target.worktree)"
Write-Host "branch=$currentBranch"
Write-Host "sync=$syncResult"

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('codex1','codex2','claude')]
    [string]$Role
)

$ErrorActionPreference = 'Stop'

$roleMap = @{
    codex1 = @{
        branch = 'dev-beta-visual'
        worktree = 'C:/Users/Akaghef/dev/M3E-dev-beta-visual'
        needsRebase = $true
    }
    codex2 = @{
        branch = 'dev-beta-data'
        worktree = 'C:/Users/Akaghef/dev/M3E-dev-beta-data'
        needsRebase = $true
    }
    claude = @{
        branch = 'dev-beta'
        worktree = 'C:/Users/Akaghef/dev/M3E'
        needsRebase = $false
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

$rebaseResult = 'skipped'
if ($target.needsRebase) {
    git fetch origin
    git rebase origin/dev-beta
    $rebaseResult = 'pass'
}

Write-Host "role=$Role"
Write-Host "worktree=$($target.worktree)"
Write-Host "branch=$currentBranch"
Write-Host "rebase=$rebaseResult"

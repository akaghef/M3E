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
        worktree = 'C:/Users/Akaghef/dev/M3E-dev-data'
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

$contextFiles = @(
    'docs/00_Home/Agent_Brief.md',
    'docs/00_Home/Current_Status.md',
    'docs/00_Home/Glossary.md'
)

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
    git rebase origin/dev-beta
    $syncResult = 'pass'
}

$missingContext = $contextFiles | Where-Object { -not (Test-Path $_) }
if ($missingContext.Count -gt 0) {
    throw "Missing mandatory context files: $($missingContext -join ', ')"
}

Write-Host "role=$Role"
Write-Host "worktree=$($target.worktree)"
Write-Host "branch=$currentBranch"
Write-Host "sync=$syncResult"
Write-Host 'context=required'
Write-Host 'read_next='
foreach ($path in $contextFiles) {
    Write-Host "  - $path"
}
Write-Host 'context_check='
Write-Host '  1. vision relevant to the task'
Write-Host '  2. current active focus/status touched by the task'
Write-Host '  3. relevant glossary terms'
Write-Host '  4. why the task fits current priorities'

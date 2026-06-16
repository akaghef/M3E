param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Args
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& node (Join-Path $ScriptDir "concat-docs.mjs") @Args
exit $LASTEXITCODE

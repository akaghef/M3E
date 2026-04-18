param(
  [int]$Bytes = 24
)

$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$buffer = New-Object byte[] $Bytes
$rng.GetBytes($buffer)
$token = [Convert]::ToBase64String($buffer).Replace("+","-").Replace("/","_").TrimEnd("=")

Write-Output $token

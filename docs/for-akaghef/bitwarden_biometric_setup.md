# Bitwarden CLI + Windows Hello（指紋認証）セットアップ

作成: 2026-04-29
目的: bw CLI 自体は biometric 非対応なので、PowerShell wrapper で
1) Windows Hello で生体認証 → 2) Credential Manager から暗号化済 BW_SESSION 取得
→ 3) API key を子プロセスに env で注入、というルートを作る。

`secrets.py` は無改変。`with-keys-bio.ps1` を `with-keys.sh` の代替として使う。

---

## 0. 前提

- Windows 11、PowerShell 5.1 以上（標準）
- Windows Hello で指紋登録済み（設定 → アカウント → サインインオプション）
- bw CLI v2024 以降、`bw login` 済み
- vault に `api/deepseek`, `api/anthropic` 等の item 作成済み（password field に sk-...）

確認:

```powershell
bw --version
bw status                              # status: locked / unlocked / unauthenticated
Get-WindowsCapability -Online | Where-Object Name -like "*Hello*"
```

---

## 1. CredentialManager モジュール

DPAPI ラップは PowerShell ギャラリーの `CredentialManager` 一発が楽:

```powershell
Install-Module -Name CredentialManager -Scope CurrentUser -Force
```

使い方:

```powershell
New-StoredCredential -Target "M3E_BW_SESSION" -UserName "bw" -Password "xxx" -Persist LocalMachine
(Get-StoredCredential -Target "M3E_BW_SESSION").Password   # SecureString
Remove-StoredCredential -Target "M3E_BW_SESSION"
```

DPAPI なので **同 Windows ユーザーアカウントのみ復号可**。他ユーザー（管理者でも）が読めない。

---

## 2. Windows Hello prompt（WinRT API）

PowerShell から直接 UWP の `UserConsentVerifier` を叩く:

```powershell
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]

function Invoke-WindowsHello([string]$Message) {
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
                       $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
    $asTask = $asTaskGeneric.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerificationResult])
    $op = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync($Message)
    $task = $asTask.Invoke($null, @($op))
    $task.Wait(-1) | Out-Null
    return $task.Result   # Verified / DeviceNotPresent / DeviceBusy / RetriesExhausted / Canceled
}

if ((Invoke-WindowsHello "M3E: API キーアクセスを承認") -ne 'Verified') {
    Write-Error "Biometric verification failed"
    exit 1
}
```

`Verified` 以外なら即終了。指紋プロンプトが UI に出る。

---

## 3. wrapper スクリプト本体

`scripts/with-keys-bio.ps1`:

```powershell
#requires -Version 5.1
param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Command
)

$ErrorActionPreference = "Stop"
$CredTarget = "M3E_BW_SESSION"
$Services   = @("deepseek", "anthropic")   # 必要に応じ増やす

# --- 1. Windows Hello -----------------------------------------------------
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]

function Invoke-WindowsHello([string]$Message) {
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
                       $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
    $asTask = $asTaskGeneric.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerificationResult])
    $op = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync($Message)
    $task = $asTask.Invoke($null, @($op))
    $task.Wait(-1) | Out-Null
    return $task.Result
}

$result = Invoke-WindowsHello "M3E: API キーアクセスを承認してください"
if ($result -ne 'Verified') {
    Write-Error "Windows Hello 認証失敗: $result"
    exit 1
}

# --- 2. session 取得 (cache or unlock) -------------------------------------
function Get-CachedSession {
    $cred = Get-StoredCredential -Target $CredTarget -ErrorAction SilentlyContinue
    if ($null -eq $cred) { return $null }
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($cred.Password)
    try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Test-Session([string]$Session) {
    if ([string]::IsNullOrEmpty($Session)) { return $false }
    $env:BW_SESSION = $Session
    $status = (bw status 2>$null | ConvertFrom-Json).status
    return $status -eq 'unlocked'
}

function New-Session {
    Write-Host "BW_SESSION 失効。master password を入力してください。" -ForegroundColor Yellow
    $session = bw unlock --raw
    if ([string]::IsNullOrEmpty($session)) { throw "bw unlock failed" }
    # 既存削除して新規保存
    Remove-StoredCredential -Target $CredTarget -ErrorAction SilentlyContinue | Out-Null
    New-StoredCredential -Target $CredTarget -UserName "bw" `
        -Password $session -Persist LocalMachine | Out-Null
    return $session
}

$session = Get-CachedSession
if (-not (Test-Session $session)) {
    $session = New-Session
}
$env:BW_SESSION = $session

# --- 3. API キー取り出し ---------------------------------------------------
foreach ($svc in $Services) {
    $envVar = ($svc.ToUpper() + "_API_KEY")
    try {
        $val = bw get password "api/$svc" --session $session 2>$null
        if (-not [string]::IsNullOrEmpty($val)) {
            Set-Item -Path "Env:$envVar" -Value $val
        }
    } catch {
        Write-Warning "api/$svc の取得失敗（vault 未登録の可能性）"
    }
}

# --- 4. 子プロセス起動 -----------------------------------------------------
if ($Command.Count -eq 0) {
    Write-Host "API keys loaded. (no command given, exiting)" -ForegroundColor Green
    exit 0
}

& $Command[0] @($Command[1..($Command.Count-1)])
$exitCode = $LASTEXITCODE

# --- 5. クリーンアップ -----------------------------------------------------
foreach ($svc in $Services) {
    Remove-Item "Env:$($svc.ToUpper())_API_KEY" -ErrorAction SilentlyContinue
}
Remove-Item Env:BW_SESSION -ErrorAction SilentlyContinue

exit $exitCode
```

---

## 4. 使い方

```powershell
# venv内のpython実行
.\scripts\with-keys-bio.ps1 python runtime\langgraph_sandbox\deepseek_smoke.py

# npmコマンド
.\scripts\with-keys-bio.ps1 npm test

# 引数なしで env load 確認のみ
.\scripts\with-keys-bio.ps1
```

bash から呼ぶラッパー（既存 `with-keys.sh` の biometric 版を別名で）:

`scripts/with-keys-bio.sh`:

```bash
#!/usr/bin/env bash
exec powershell.exe -NoProfile -ExecutionPolicy Bypass \
    -File "$(dirname "$0")/with-keys-bio.ps1" -- "$@"
```

---

## 5. session 寿命と再認証

- BW_SESSION はサーバ側設定の vault timeout（デフォルト無期限、個人で変更可）まで有効
- `bw lock` 実行 or `bw logout` で即無効
- session 失効すると自動で master password prompt にフォールバック → 指紋＋passwordの2要素になる瞬間
- 1日1回程度は master password 求められると思ってよい

vault timeout を短くしたければ Web Vault → Account Settings → Security → Vault Timeout で調整。

---

## 6. 不変式（runtime.md に書く分）

- **I-S5**: API key は plaintext で disk に存在しない（DPAPI 暗号化のみ）
- **I-S6**: vault unlock は biometric で gate される（Verified 以外で全工程拒否）
- **I-S7**: 子プロセス終了時に env から API key を unset する
- **I-S8**: BW_SESSION 復号は同 Windows ユーザーのみ可能（DPAPI 仕様）

---

## 7. 既存 `secrets.py` との関係

`secrets.py` は **env → vault → raise** の解決順なので、wrapper が env に流せばそれで完結。
`secrets.py` 側は完全に無改変。

```python
# 呼び出しは変わらない
api_key = get_secret("deepseek")
```

---

## 8. 失敗パターンと対処

| 症状 | 原因 | 対処 |
|---|---|---|
| `RequestVerificationAsync` が DeviceNotPresent | Windows Hello 未設定 | 設定 → Hello で指紋登録 |
| Cancel 連発 | 指紋認識率が低い | PIN フォールバックを Hello 設定で許可 |
| `bw status` が unauthenticated | login 切れ | `bw login` から |
| Cred Manager に書けない | 企業ポリシー | `-Persist Session` に変更（再起動で消える） |
| PowerShell 実行ポリシー | Restricted | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |

---

## 9. セキュリティ評価

| 脅威 | 防御 |
|---|---|
| disk 物理盗難 | DPAPI（ユーザー鍵）で復号不可 |
| 別ユーザー（管理者含む）が読む | DPAPI が同ユーザー限定 |
| マルウェアが prompt 偽装 | Hello は OS UI（プロセス側偽装は困難） |
| マルウェアが env 奪取 | wrapper 内の子プロセスのみ env 持つ。親 shell は無汚染 |
| session token 漏洩 | timeout 経過で自動失効、`bw lock` で即無効 |
| master password 漏洩 | wrapper は password 保存しない |

完全防御ではない（実行中プロセスから debugger で抜けるなど高位攻撃は防げない）が、
**.env に sk-... を平文置く方式と比較して2〜3段安全**。

---

## 10. 段階導入

1. **Phase 0**: `with-keys.sh`（bash 版、master password のみ）で運用開始
2. **Phase 1**: 不便さを感じたら `with-keys-bio.ps1` 導入。`secrets.py` は無改変
3. **Phase 2**: vault timeout を短く（4h など）して頻繁再認証で session 寿命を制限
4. **Phase 3**: チームに広げるなら organization 管理 + secret rotation 自動化（別 PJ）

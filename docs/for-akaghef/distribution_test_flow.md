# 配布テストフロー

M3E のインストーラーが別環境で正常に動くかを検証するフロー。
2つの方式がある。普段は方式A（別ユーザー）で高速に回し、リリース前に方式B（VM）で最終確認。

---

## 方式A: 別ユーザー検証

同じ PC 上に別ユーザーを作り、そのユーザーとしてテストを実行する。
セットアップ1分、実行30秒。ただし Node.js や OS 設定はホストと共有。

### 初回セットアップ（1回だけ）

管理者権限のコマンドプロンプトで:

```bat
scripts\ops\setup_test_user.bat
```

これで:
- `m3e_test` ユーザーが作成される（パスワード: `M3eTest2026!`）
- 共有レポートフォルダ `C:\M3E_test_reports\` が作成される

### テスト実行（毎回）

#### Step 1: テストパッケージ作成

```bat
scripts\ops\build_test_package.bat
```

final/ のビルドと install スクリプトを `C:\M3E_test_package\` にパッケージ化。
Node.js ランタイムもホストからコピーされる。

#### Step 2: テスト実行

```bat
runas /user:m3e_test "C:\M3E_test_package\run_test.bat"
```

パスワード `M3eTest2026!` を入力。あとは自動で:

1. **Setup** — テストパッケージの payload を m3e_test の `%LOCALAPPDATA%\M3E\` に展開
2. **Verify** — runtime, app, SQLite の存在チェック + 書き込みテスト
3. **Launch** — サーバー起動（port 39876）、応答待ち
4. **Smoke** — API POST + GET round-trip テスト
5. **Report** — 結果を `C:\M3E_test_reports\test_YYYYMMDD_HHMMSS\` に出力
6. **Diagnostic** — collect_report.bat で診断 zip も自動収集

#### Step 3: 結果確認

```bat
type C:\M3E_test_reports\test_*\report.txt
```

report.txt のフォーマット:
```
Summary
  Setup:   PASS / FAIL [exit code]
  Verify:  PASS / FAIL / SKIP
  Launch:  PASS / FAIL (server timeout)
  Smoke:   PASS / FAIL (POST/GET failed)
```

#### 詳細ログ

レポートディレクトリに以下が保存される:
- `setup.log` / `setup_detail.log` — セットアップの詳細
- `verify.log` / `verify_detail.log` — 検証の詳細
- `server.log` — サーバー起動ログ
- `smoke.txt` — API テスト結果
- `M3E_report_*.zip` — collect_report の診断 zip

### トラブルシューティング

| 症状 | 確認ポイント |
|------|------------|
| Setup が FAIL | `setup_detail.log` を確認。`dir C:\M3E_test_package\payload\` でファイルが揃っているか |
| Launch が timeout | `server.log` を確認。better-sqlite3 の native addon 不一致や Node.js バージョン差異 |
| m3e_test 環境をリセットしたい | `runas /user:m3e_test "cmd /c rmdir /s /q %LOCALAPPDATA%\M3E"` |
| m3e_test ユーザーを削除 | `net user m3e_test /delete` |

---

## 方式B: VM 自動検証（VirtualBox）

完全クリーン環境で毎回テストできる。Node.js が無い状態からのインストールも検証可能。
ただし VM はあくまで1パターン（Win11 Enterprise 評価版）なので、全環境の保証ではない。

### 初回セットアップ

#### 1. VirtualBox インストール

- https://www.virtualbox.org/wiki/Downloads から **Windows hosts** をダウンロード
- インストールして再起動

#### 2. Windows 11 評価版 ISO を取得

1. https://www.microsoft.com/en-us/evalcenter/evaluate-windows-11-enterprise にアクセス
2. 「Download the ISO」をクリック → フォーム入力 → ISO ダウンロード（約5GB）
3. 言語は **English (United States)** を選択
4. 「Windows 11 and Office 365 Deployment Lab Kit」ではなく **Windows 11 Enterprise** の方を選ぶこと

#### 3. VM 作成

VirtualBox で「新規」をクリック:

| 設定項目 | 値 |
|---------|---|
| Name | `M3E-Test` |
| ISO Image | ダウンロードした ISO を選択 |
| Type | Microsoft Windows / Windows 11 (64-bit) |
| RAM | 4096 MB |
| Processors | 2 |
| Hard Disk | 40 GB |
| EFI | 有効（Windows 11 は必須） |

無人インストール設定画面:
- ユーザー名: `m3etest`
- パスワード: `m3etest`（`vm_test.bat` の `GUEST_PASS` と合わせること）
- プロダクトキー: `NPPR9-FWDCX-D2C8J-H872K-2YT43`（Enterprise 評価用の汎用キー。空欄だと次へ進めない）
- ホスト名: `M3E-Test`

**重要**: VM 作成後、Windows のインストールが自動で始まる。**デスクトップが表示されるまで待つこと**。途中でスナップショットを撮ると、毎回インストールからやり直しになる。

#### 4. Guest Additions インストール

Windows インストール完了後、VM の画面で:

1. 上部メニュー → **「デバイス」** → **「Guest Additions CD イメージの挿入」**
2. VM 内でエクスプローラー → **PC** → **CD ドライブ（D:）** を開く
3. **`VBoxWindowsAdditions.exe`** を実行
4. インストーラーに従って進める → **再起動**

確認: ホスト側から以下が通ればOK:
```powershell
& "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" guestcontrol "M3E-Test" run --username "m3etest" --password "m3etest" --exe "C:\Windows\System32\hostname.exe" --wait-stdout
```

Guest Additions が入っていないと `guestcontrol` が使えず、自動テストが動かない。

#### 5. 共有フォルダ設定

まずホスト側にフォルダを作成:
```bat
mkdir C:\M3E_test_package
mkdir C:\M3E_test_reports
```

VM を**電源オフ**にしてから、VirtualBox マネージャー → VM を選択 → **「設定」** → **「共有フォルダー」**:

| フォルダーパス | フォルダー名 | 自動マウント | 読み取り専用 | 種類 |
|---|---|---|---|---|
| `C:\M3E_test_package` | `M3E_pkg` | ✓ | ✓ | **固定**（永続） |
| `C:\M3E_test_reports` | `M3E_reports` | ✓ | ✗ | **固定**（永続） |

「一時的」ではなく**「固定」に追加**すること。一時的だとスナップショット復元時に消える。

マウントポイントは空欄でOK（自動割り当て）。入力が必須の場合は任意のドライブレター（例: `Y:`, `Z:`）を指定。

**重要**: 実際に割り当てられたドライブレターを確認すること。VM 内で `net use` を実行して、パッケージがどのドライブかを確認し、`vm_test.bat` の `Z:\run_test.bat` を実際のドライブレターに合わせる。

#### 6. スナップショット保存

以下がすべて完了した状態で:
- Windows インストール済み
- Guest Additions インストール済み
- 共有フォルダ設定済み

VM を**電源オフ** → VirtualBox マネージャー → **スナップショットタブ** → **「作成」** → 名前: `clean`

### テスト実行

#### 事前準備（毎回）

テストパッケージを作成:
```bat
scripts\ops\build_test_package.bat
```

#### Cold モード（クリーンテスト）

スナップショット復元 → 起動 → テスト → 電源オフ:
```bat
scripts\ops\vm_test.bat
```

#### Warm モード（繰り返しテスト）

VM を起動したまま、テストだけ繰り返し実行（電源オフしない）:
```bat
scripts\ops\vm_test.bat warm
```

VM を手動で起動しておく:
```powershell
& "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" startvm "M3E-Test"
```

#### 結果確認

```bat
type C:\M3E_test_reports\test_*\report.txt
```

### VM 方式のトラブルシューティング

| 症状 | 原因と対処 |
|------|----------|
| `VBoxManage` が見つからない | `vm_test.bat` 内でフルパス指定済み。手動で使う場合は `& "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"` |
| PowerShell で PATH が通らない | `$env:Path += ";C:\Program Files\Oracle\VirtualBox"` を毎回実行するか、bat ファイル内のフルパスに頼る |
| Guest OS not responding | 起動に時間がかかっている。`WAIT_BOOT` を増やす。Guest Additions が入っているか確認 |
| `Z:\run_test.bat` が見つからない | 共有フォルダのドライブレターが違う。VM 内で `net use` を実行して確認し、`vm_test.bat` を修正 |
| `build_test_package.bat` 未実行 | Launch が SKIP（runtime not installed）になる。先にパッケージを作成する |
| テストがタイムアウト | `WAIT_TEST` を増やす（デフォルト 300秒） |
| `setlocal` が `tlocal` エラー | bat ファイルに UTF-8 BOM が付いている。エディタで BOM なし UTF-8 で保存し直す |

### 方式比較

| 観点 | 方式A（別ユーザー） | 方式B（VM） |
|------|-------------------|------------|
| セットアップ | 1分 | 30-60分 |
| 実行時間 | 30秒 | 3-5分 |
| クリーンさ | 同じ OS/Node 共有 | 完全独立（Node なし状態からテスト可） |
| 自動化 | ○ | ◎（スナップショット復元で毎回クリーン） |
| ディスク | 0 | 20-40 GB |
| 再テスト | 毎回同じ環境 | cold=クリーン / warm=差分テスト |

### テストの限界

VM テストは「自分の PC 以外で動く」最低限の確認。以下は検証できない:
- 異なる Windows バージョン（Win10, 異なるビルド）
- 異なるエディション（Home, Pro）
- セキュリティソフトによるブロック
- 日本語ユーザー名のパス問題
- 実際のブラウザでの UI 操作

最終的には実際のユーザーに使ってもらうのが一番確実。

---

## ファイル一覧

| ファイル | 場所 | 用途 |
|---------|------|------|
| `setup_test_user.bat` | scripts/ops/ | 方式A: テストユーザー作成 |
| `build_test_package.bat` | scripts/ops/ | 共通: テストパッケージ作成 |
| `run_test.bat` | scripts/ops/ | 共通: テスト実行スクリプト |
| `vm_test.bat` | scripts/ops/ | 方式B: VM テスト自動化 |
| report.txt | C:\M3E_test_reports\ | 共通: テスト結果レポート |

## vm_test.bat の設定値

スクリプト先頭で変更可能:

| 変数 | デフォルト | 説明 |
|------|----------|------|
| `VM_NAME` | `M3E-Test` | VirtualBox の VM 名 |
| `SNAPSHOT` | `clean` | 復元するスナップショット名 |
| `GUEST_USER` | `m3etest` | VM 内の Windows ユーザー名 |
| `GUEST_PASS` | `m3etest` | VM 内の Windows パスワード |
| `WAIT_BOOT` | `180` | 起動待ち秒数（初回） |
| `WAIT_TEST` | `300` | テスト実行タイムアウト秒数 |
| `VBOX` | `C:\Program Files\Oracle\VirtualBox\VBoxManage.exe` | VBoxManage のフルパス |

# 配布テストフロー（別ユーザー検証）

M3E のインストーラーが別ユーザー環境で正常に動くかを検証するフロー。
Akaghef の手作業を最小化する設計。

## 初回セットアップ（1回だけ）

管理者権限のコマンドプロンプトで:

```bat
scripts\ops\setup_test_user.bat
```

これで:
- `m3e_test` ユーザーが作成される（パスワード: `M3eTest2026!`）
- 共有レポートフォルダ `C:\M3E_test_reports\` が作成される

## テスト実行（毎回）

### Step 1: テストパッケージ作成

```bat
scripts\ops\build_test_package.bat
```

final/ のビルドと install スクリプトを `C:\M3E_test_package\` にパッケージ化。

### Step 2: テスト実行（1コマンド）

```bat
runas /user:m3e_test "C:\M3E_test_package\run_test.bat"
```

パスワード `M3eTest2026!` を入力。あとは自動で:

1. **Setup** — install スクリプトで m3e_test の `%LOCALAPPDATA%\M3E\` にインストール
2. **Verify** — runtime, app, SQLite の存在チェック + 書き込みテスト
3. **Launch** — サーバー起動（port 39876）、応答待ち
4. **Smoke** — API POST + GET round-trip テスト
5. **Report** — 結果を `C:\M3E_test_reports\test_YYYYMMDD_HHMMSS\` に出力
6. **Diagnostic** — collect_report.bat で診断 zip も自動収集

### Step 3: 結果確認

```bat
dir C:\M3E_test_reports\
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

### 詳細ログ

レポートディレクトリに以下が保存される:
- `setup.log` / `setup_detail.log` — セットアップの詳細
- `verify.log` / `verify_detail.log` — 検証の詳細
- `server.log` — サーバー起動ログ
- `smoke.txt` — API テスト結果
- `M3E_report_*.zip` — collect_report の診断 zip

## トラブルシューティング

### setup が FAIL する場合
- `setup_detail.log` を確認
- payload/ のファイルが揃っているか: `dir C:\M3E_test_package\payload\`

### launch が timeout する場合
- `server.log` を確認
- better-sqlite3 の native addon がアーキテクチャ不一致の可能性
- Node.js のバージョン差異

### m3e_test 環境をリセットしたい場合
```bat
REM m3e_test のデータを全削除
runas /user:m3e_test "cmd /c rmdir /s /q %LOCALAPPDATA%\M3E"
```

### m3e_test ユーザーを削除
```bat
net user m3e_test /delete
```

---

## 方式B: VM 自動検証（VirtualBox）

別ユーザー方式より本番に近い。完全クリーン環境で毎回テストできる。

### 初回セットアップ（1回だけ、30分くらい）

1. **VirtualBox インストール**
   - https://www.virtualbox.org/wiki/Downloads から Windows hosts をダウンロード
   - インストールして再起動

2. **Windows VM 作成**
   - Microsoft 公式の評価版 ISO を取得: https://www.microsoft.com/en-us/evalcenter/evaluate-windows-11-enterprise
   - VirtualBox で新規 VM 作成（RAM: 4GB, Disk: 40GB, Name: `M3E-Test`）
   - ISO からインストール（ユーザー名は何でもOK）

3. **Guest Additions インストール**（VM 内で）
   - VirtualBox メニュー → Devices → Insert Guest Additions CD
   - VM 内で実行してインストール → 再起動
   - これで共有フォルダが使える

4. **共有フォルダ設定**
   - VirtualBox の VM 設定 → Shared Folders
   - 追加: ホスト側 `C:\M3E_test_package` → VM 内 `M3E_pkg` (Auto-mount, Read-only)
   - 追加: ホスト側 `C:\M3E_test_reports` → VM 内 `M3E_reports` (Auto-mount, Full access)

5. **クリーンスナップショット保存**
   - VM を起動した状態で VirtualBox → Machine → Take Snapshot
   - 名前: `clean` 
   - これが毎回のテスト起点になる

### テスト実行（毎回、1コマンド）

```bat
scripts\ops\vm_test.bat
```

内部でやること（全自動）:
1. `VBoxManage snapshot "M3E-Test" restore "clean"` — クリーン状態に復元
2. `VBoxManage startvm "M3E-Test" --type headless` — VM をバックグラウンド起動
3. `VBoxManage guestcontrol "M3E-Test" run` — VM 内で `run_test.bat` を実行
4. レポートが共有フォルダ経由で `C:\M3E_test_reports\` に出力される
5. `VBoxManage controlvm "M3E-Test" poweroff` — VM 停止

### 結果確認

別ユーザー方式と同じ:
```bat
type C:\M3E_test_reports\test_*\report.txt
```

### 方式比較

| 観点 | 別ユーザー | VM |
|------|-----------|-----|
| セットアップ | 1分 | 30分 |
| 実行時間 | 30秒 | 2-3分 |
| クリーンさ | 同じ OS/Node 共有 | 完全独立（Node なし状態からテスト可） |
| 自動化 | ○ | ◎（スナップショット復元で毎回クリーン） |
| ディスク | 0 | 20-40 GB |

**推奨**: 普段は別ユーザー方式で高速に回す。リリース前に VM で最終確認。

---

## ファイル一覧

| ファイル | 場所 | 用途 |
|---------|------|------|
| `setup_test_user.bat` | scripts/ops/ | 初回: テストユーザー作成 |
| `build_test_package.bat` | scripts/ops/ | 毎回: パッケージ作成 |
| `run_test.bat` | scripts/ops/ | 毎回: テスト実行（m3e_test が実行） |
| report.txt | C:\M3E_test_reports\ | 結果レポート |

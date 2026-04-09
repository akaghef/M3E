# Distribution Validation Balanced Plan

## 目的

個人利用フェーズでの手元運用負担を最小化しつつ、将来の企業配布へ移行可能な配布・検証導線を先に設計する。

この文書は `beta` 開発での配布検証基準として扱う。

## 前提

- 現行の開発ターゲットは `beta/`
- 配布対象は当面 Windows 利用者が中心
- 既存の `install/setup.bat` と `scripts/final/*` を活用し、全面刷新は行わない

## 結論（採用方針）

1. 公式配布物は `Inno Setup` で生成するインストーラー（`.exe`）を主軸にする
2. `Windows Sandbox` を使ったクリーン環境スモークテストを毎リリースで自動実行する
3. 失敗解析のために install/launch/uninstall のログを artifact として保存する
4. `zip` 配布は当面「補助導線（非推奨）」として残し、サポート優先度を下げる

## なぜこの方針か

- 個人利用で最小の運用コスト: 1 コマンドで検証を完了できる
- 配布品質の安定化: ユーザー環境差分（既存 Node、PATH、既存設定）の影響を減らせる
- 企業配布への接続性: 署名、サイレント導入、管理配布（Intune/GPO）に段階移行しやすい

## 選択肢比較（採用判断済み）

### Option A: `setup.bat` + zip 継続

- 長所: 追加実装が少ない
- 短所: 環境差分で壊れやすく、配布品質の再現性が低い
- 評価: 暫定運用には可、主軸には不適

### Option B: Inno Setup + Windows Sandbox（採用）

- 長所: 速く導入でき、再現性と自動化のバランスが良い
- 短所: installer 作成と検証スクリプトの初期整備が必要
- 評価: 個人運用負担最小と将来拡張の両立ができる

### Option C: 初期から MSI/MSIX

- 長所: 企業配布との親和性が高い
- 短所: 現フェーズでは実装・運用コストが重い
- 評価: 企業案件要件が確定した時点で移行検討

## 自動化設計（1 コマンド運用）

### 目標コマンド

```powershell
pwsh -File install2/windows/build-installer.ps1 -Version vMMYYDD
```

### 実行フロー

1. `final/` を build
2. Inno Setup で installer 生成
3. `.wsb` を動的生成して Windows Sandbox 起動
4. Sandbox 内で installer をサイレント実行（install log 出力）
5. 初回起動と health check（`http://localhost:38482/viewer.html` 応答確認）
6. アンインストール実行（uninstall log 出力）
7. ログと結果サマリーを `artifacts/release-tests/<timestamp>/` へ保存

### 生成物設計

- `artifacts/installer/M3E-Setup-<version>.exe`
- `artifacts/release-tests/<timestamp>/install.log`
- `artifacts/release-tests/<timestamp>/launch.log`
- `artifacts/release-tests/<timestamp>/uninstall.log`
- `artifacts/release-tests/<timestamp>/summary.json`

## インストーラー実行時のユーザー分岐

対象: `M3E-Setup-vMMYYDD.exe`

### 分岐の全体像

1. 既存インストール有無を判定
2. 既存設定（`m3e.conf`）有無を判定
3. 既存データ（`m3e.sqlite` 等）有無を判定
4. migration 必要性を判定（バージョン差分）
5. 成功/失敗時の後処理を分岐

### ユーザータイプ別フロー

#### A. 初回ユーザー（新規）

- インストール種別: 新規
- 設定: デフォルト設定を新規作成
- データ: 空データで初期化
- migration: 実行しない
- 完了条件: 起動可能でショートカットが作成される

#### B. 既存ユーザー（旧版 -> 新版）

- インストール種別: 更新
- 設定: 既存 `m3e.conf` を引き継ぐ
- データ: migration 前に自動バックアップを作成
- migration: 必要な場合のみ実行
- 失敗時: 起動を停止し、ログと復旧手順を表示する

#### C. 既存ユーザー（同版再実行）

- インストール種別: 修復（再インストール）
- 設定: 既存設定を保持
- データ: 原則変更しない
- migration: 実行しない（バージョン差分なし）
- 完了条件: 破損復旧と再起動成功

#### D. 企業端末ユーザー（将来）

- インストール種別: サイレント導入（管理配布）
- 設定: 管理者指定パラメータを優先
- データ: ユーザーデータ非破壊を維持
- migration: バージョン差分に応じて実行
- 失敗時: 管理者向けログ（install/migration/uninstall）を必須出力

### 実装時に固定する判定ルール（必須）

1. 新規/更新/修復の判定条件
2. 設定引き継ぎ対象キーと上書きキー
3. migration 実行条件（fromVersion/toVersion）
4. 失敗時の停止条件とロールバック方針
5. アンインストール時のデータ保持ポリシー

## 必須検証シナリオ（最小）

1. 新規インストールが成功する
2. 起動後に viewer へ到達できる
3. 再起動しても起動できる
4. アンインストールが成功する
5. 旧版 -> 新版の更新インストールが成功する

## 実装ステップ（粗め）

### Step 1（最短）

- `install2/setup.bat` に無人実行引数を追加
  - `--silent`
  - `--data-dir`
  - `--no-launch`
  - `--log`

### Step 2（本線化）

- `install2/windows/m3e.iss` を追加
- `install2/windows/build-installer.ps1` を追加
- サイレント導入ログとアンインストールログを取得可能にする

### Step 3（負担最小運用）

- `install2/windows/run-sandbox.ps1` を追加
- 将来的に `release-check.ps1` を追加し、build -> installer -> sandbox 検証を一括実行する

## 企業向け拡張（後段）

1. コード署名導入（SmartScreen 対策）
2. `winget` 配布または MSI/MSIX 追加
3. プロキシ制限環境・管理者権限制限環境での検証ケース追加

## 運用ルール

- release 判定前に `release-check.ps1` 成功を必須化
- 失敗時は `summary.json` と各ログを daily に記録し、再現手順を残す
- `zip` は開発者向け補助導線として残すが、正式サポートは installer を優先する

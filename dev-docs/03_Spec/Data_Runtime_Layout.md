# Data Runtime Layout

## 目的

- 350+ ノードの整理済みDBを `seed` として固定する
- `beta` と `final` は同じ原本から別の実行用コピーを持つ
- DB だけでなく backup, audit, cloud-sync, first-run marker も workspace ごとに分離する

## 用語

- `seed`: 原本DB。通常運用では直接編集しない
- `main workspace`: `final` が開く本番用コピー
- `sandbox workspace`: `beta` が開く開発用コピー
- `tutorial scope`: `seed` / `main` / `sandbox` の中に同梱されるチュートリアル用スコープ。別DBにはしない

## 配置

### リポジトリ内

```text
install/
  assets/
    seeds/
      core-seed.sqlite
```

### ユーザーローカル

```text
%LOCALAPPDATA%\M3E\
  seeds\
    core-seed.sqlite
  workspaces\
    main\
      data.sqlite
      .m3e-launched
      audit\
      backups\
      cloud-sync\
      conflict-backups\
    sandbox\
      data.sqlite
      .m3e-launched
      audit\
      backups\
      cloud-sync\
      conflict-backups\
  m3e.conf
```

## 命名

| 概念 | 値 |
|---|---|
| seed DB | `core-seed.sqlite` |
| main DB | `data.sqlite` |
| sandbox DB | `data.sqlite` |
| runtime doc id | `akaghef-beta` |
| workspace label | `main` / `sandbox` |
| tutorial scope id | `n_1775650869381_rns0cp` |
| final port | `38482` |
| beta port | `4173` |

DB ファイル名は workspace 内では共通の `data.sqlite` とし、役割の違いはディレクトリで表現する。

## 起動ルール

- `final` は `%LOCALAPPDATA%\M3E\workspaces\main\data.sqlite` を開く
- `beta` は `%LOCALAPPDATA%\M3E\workspaces\sandbox\data.sqlite` を開く
- workspace DB が未作成で seed が存在する場合、起動前に `seed -> workspace` をコピーする
- `seed` が未配置で、リポジトリまたは配布物に `install/assets/seeds/core-seed.sqlite` がある場合は、まずそこから `%LOCALAPPDATA%\M3E\seeds\core-seed.sqlite` を作る
- 初回起動時の tutorial は別DBを読むのではなく、現在開いている workspace 内の `tutorial scope id` を開く

## 更新ルール

- `seed` は release 用の原本。runtime DB を自動で上書きしない
- `final` 更新時は `main workspace` を上書きしない
- `beta` の検証データは `sandbox workspace` に閉じ込める
- `beta` で必要な整理結果を release したい場合は、`seed` を更新してから配布物を再生成する
- tutorial データは別配布DBではなく `seed` に含める。修正が必要な場合は `tutorial scope` を含む `seed` 自体を更新する

## 設定ファイル

`%LOCALAPPDATA%\M3E\m3e.conf` には少なくとも以下を保存する。

```text
M3E_HOME=%LOCALAPPDATA%\M3E
M3E_SEED_DB_PATH=%LOCALAPPDATA%\M3E\seeds\core-seed.sqlite
M3E_MAIN_DATA_DIR=%LOCALAPPDATA%\M3E\workspaces\main
M3E_MAIN_DB_FILE=data.sqlite
M3E_MAIN_DOC_ID=akaghef-beta
M3E_MAIN_WORKSPACE_ID=main
M3E_PORT=38482
```

`final` の packaged launcher はこの値を読み、`M3E_DATA_DIR`, `M3E_DB_FILE`, `M3E_DOC_ID`, `M3E_WORKSPACE_ID` に変換して起動する。

## 今日のスコープ

- この layout を `scripts/beta/*`, `scripts/final/*`, `install/setup.bat`, `install/dist/*`, `scripts/ops/*` に反映する
- 既存ユーザーの旧 `M3E_dataV1.sqlite` からの移行は別タスクで扱う

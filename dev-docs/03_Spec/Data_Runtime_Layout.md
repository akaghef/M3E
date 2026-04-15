# Data Runtime Layout

## 目的

- M3E の runtime データ配置を `workspace / map / scope` 基準で固定する
- `beta=4173` を Akaghef の日常開発・研究運用の標準チャネルにする
- 旧 `main / sandbox / akaghef-beta` 前提を新仕様の SSOT から外す
- データ移植を前提にせず、workspace 単位で安全に運用できる構造にする

## 概念整理

### 階層

```text
ws > map > scope > node
```

- `ws`:
  永続データ実体。`data.sqlite` だけでなく backup, audit, cloud-sync, conflict-backups を含むフォルダ単位
- `map`:
  workspace 内の作業単位。例: `開発`, `研究`, `tutorial`
- `scope`:
  map 内の階層的構造境界。見える範囲・編集範囲の基本単位
- `node`:
  最小要素

### 軸

| 軸 | 意味 | 現在の標準 |
|---|---|---|
| owner | 誰のデータか | `akaghef` |
| data profile | データの運用レベル | `personal` |
| channel | どの実行チャネルで開くか | `beta` / `final` |
| workspace | 永続データ実体 | `Akaghef-personal` |
| map | workspace 内の作業単位 | `開発`, `研究`, `tutorial` |

## 識別子ルール

| 項目 | 役割 | ルール |
|---|---|---|
| `wsId` | workspace の内部識別子 | `ws_<ULID>` |
| `wsLabel` | workspace の表示名 | 人間可読。現在の標準は `Akaghef-personal` |
| `mapId` | map の内部識別子 | `map_<ULID>` |
| `mapLabel` | map の表示名 | 人間可読。変更可 |
| `mapSlug` | map の固定スラッグ | 人間可読補助名。変更不可 |
| `docId` / `documentId` | 実装互換名 | 当面残してよいが、仕様上は `mapId` / `map` を優先する |

### 現在の標準 map

| 対象 | mapLabel | mapSlug |
|---|---|---|
| Akaghef personal | `開発` | `beta-dev` |
| Akaghef personal | `研究` | `beta-research` |
| 一般ユーザー final 配布 | `tutorial` | `final-tutorial` |

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
    <wsId>\
      data.sqlite
      .m3e-launched
      audit\
      backups\
      cloud-sync\
      conflict-backups\
  m3e.conf
```

`workspace` は DB ファイル単体ではなく、運用一式を収めるフォルダとして扱う。

## 保存先解決ルール

`wsId` は保存先フォルダを一意に決める内部 ID である。`wsLabel` は表示名であり、保存先解決には使わない。

### 例

```text
wsId = ws_01ABC...
  -> %LOCALAPPDATA%\M3E\workspaces\ws_01ABC...\
     data.sqlite
     backups\
     audit\
     cloud-sync\
     conflict-backups\
```

### 解決表

| 入力 | 解決先 |
|---|---|
| `wsId` | `workspaceDir` |
| `wsId` | `data.sqlite` の絶対パス |
| `wsId` | `backups/` |
| `wsId` | `audit/` |
| `wsId` | `cloud-sync/` |
| `wsId` | `conflict-backups/` |

## 起動ルール

- `beta` は原則として Akaghef の `personal` workspace を開く
- `final` は配布・安定確認用チャネルとして動作する
- workspace が未作成で `seed` が存在する場合、起動前に `seed -> workspace` をコピーして初期化する
- `seed` が未配置で、配布物またはリポジトリに `install/assets/seeds/core-seed.sqlite` がある場合は、まずそこから `%LOCALAPPDATA%\M3E\seeds\core-seed.sqlite` を作る
- `tutorial` は別 DB ではなく、現在開いている workspace 内の tutorial map / scope として同居してよい

## 初期生成ポリシー

| 対象 | 初期生成する map |
|---|---|
| Akaghef personal workspace | `開発`, `研究` |
| 一般ユーザー向け final 配布 | `tutorial` のみ |

## 更新ルール

- `seed` は release 用の原本であり、runtime DB を自動で上書きしない
- `workspace` は channel より上位の永続実体であり、名称変更のたびにデータ移植を要求しない
- `mapLabel` の変更では `mapId` と保存実体を変えない
- `wsLabel` の変更では `wsId` と保存実体を変えない
- `beta` で得た改善を release へ反映したい場合は、`seed` と配布物を更新する

## 設定ファイル

`%LOCALAPPDATA%\M3E\m3e.conf` には少なくとも以下を保存する。

```text
M3E_HOME=%LOCALAPPDATA%\M3E
M3E_SEED_DB_PATH=%LOCALAPPDATA%\M3E\seeds\core-seed.sqlite
M3E_WORKSPACE_ID=ws_<ULID>
M3E_WORKSPACE_LABEL=Akaghef-personal
M3E_DATA_DIR=%LOCALAPPDATA%\M3E\workspaces\ws_<ULID>
M3E_DB_FILE=data.sqlite
M3E_CHANNEL=beta
M3E_PORT=4173
```

必要に応じて map 選択用の現在値を別キーで持ってよい。

```text
M3E_MAP_ID=map_<ULID>
M3E_MAP_LABEL=開発
M3E_MAP_SLUG=beta-dev
```

## 仕様上の方針

- 仕様語は `map` を使う
- 実装や既存 API に残る `docId` / `documentId` は互換名として扱う
- `scope` は M3E 固有概念として維持する
- `folder` は一般向け導入語としてのみ使う

## 受け入れ条件

| テスト | 期待値 |
|---|---|
| workspace 解決 | 同じ `wsId` から常に同じ保存先フォルダが解決される |
| workspace 表示 | `wsLabel` を変えても保存先は変わらない |
| map 識別 | `mapId` は不変、`mapLabel` は変更可、`mapSlug` は固定 |
| beta 日常運用 | `beta=4173` で Akaghef personal workspace を標準起動できる |
| final 配布初期化 | 一般ユーザー final は `tutorial` を初期 map として作成できる |
| 概念整合 | 文書・UI・実装説明が `ws > map > scope > node` と矛盾しない |

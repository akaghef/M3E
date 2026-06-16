# Workspace / Map 棚卸し (2026-04-16)

akaghef の個人データを機能別にどう分けているか、現状の実データから確認したもの。

## 用途別 Workspace ID / DB Path 早見表

現行コードとランチャー定義から、akaghef が日常的に触る先を用途別に並べると次の通り。

| 用途 | channel | Workspace ID | DB file path | 主に開く map |
|---|---|---|---|---|
| 開発用の個人データ | beta | `ws_REMH1Z5TFA7S93R3HA0XK58JNR` | `C:\Users\Akaghef\AppData\Local\M3E\workspaces\ws_REMH1Z5TFA7S93R3HA0XK58JNR\data.sqlite` | `map_BG9BZP6NRDTEH1JYNDFGS6S3T5` (`開発`, `beta-dev`) |
| 研究用の個人データ | beta | `ws_REMH1Z5TFA7S93R3HA0XK58JNR` | `C:\Users\Akaghef\AppData\Local\M3E\workspaces\ws_REMH1Z5TFA7S93R3HA0XK58JNR\data.sqlite` | `map_10226A7F0MEKDVNMEXC7HH4GNV` (`研究`, `beta-research`) |
| 配布版 / tutorial 確認 | final | `ws_A98E70JM9GAXCVXVMQBW7N0YGZ` | `C:\Users\Akaghef\AppData\Local\M3E\workspaces\ws_A98E70JM9GAXCVXVMQBW7N0YGZ\data.sqlite` | `map_09N0MQPFEQN9D4K66VNMT1F69V` (`tutorial`, `final-tutorial`) |

ポイント:

- **beta の `開発` と `研究` は workspace を分けていない。**
  どちらも `Akaghef-personal` という同じ workspace の `data.sqlite` を使い、map だけを分けている。
- **final は別 workspace。**
  配布確認や tutorial の検証は `ws_A98E70JM9GAXCVXVMQBW7N0YGZ` 側の `data.sqlite` を使う。
- どのランチャーも最終的には `M3E_DATA_DIR + M3E_DB_FILE` で保存先が決まる。

定義元:

- [beta/src/node/start_viewer.ts](../../beta/src/node/start_viewer.ts)
- [final/src/node/start_viewer.ts](../../final/src/node/start_viewer.ts)
- [scripts/beta/launch.bat](../../scripts/beta/launch.bat)
- [scripts/final/launch.bat](../../scripts/final/launch.bat)

## 結論

- **workspace (ws_)** は個人用に **1 つだけ**。機能ごとに分かれていない。
- beta 内で機能を分けているのは **map** の層。
- final の tutorial 導線だけは別 workspace を使う。

## Workspace 一覧

場所: `C:\Users\Akaghef\AppData\Local\M3E\workspaces\`

| Workspace ID | Label | 備考 |
|---|---|---|
| `ws_REMH1Z5TFA7S93R3HA0XK58JNR` | Akaghef-personal | 実データあり（12 documents） |
| `ws_A98E70JM9GAXCVXVMQBW7N0YGZ` | Personal | final / tutorial 用の標準 workspace |
| `main/` | — | backups ディレクトリのみ、documents テーブル無し |

定義元: [start_viewer.ts:97-108](../../beta/src/node/start_viewer.ts#L97-L108)

```ts
const DEFAULT_WORKSPACE_ID = "ws_REMH1Z5TFA7S93R3HA0XK58JNR";
const DEFAULT_WORKSPACE_LABEL = "Akaghef-personal";
```

`DEFAULT_WORKSPACE_ID` はコード上で 1 つ固定。URL の `?ws=` パラメータは受けるが、他の ws 定義はコード中にも DB 中にも存在しない。

## Map 一覧（Akaghef-personal 内）

`C:\Users\Akaghef\AppData\Local\M3E\workspaces\ws_REMH1Z5TFA7S93R3HA0XK58JNR\data.sqlite` の `documents` テーブルより。

| Map ID | Label | ノード数 | 用途 |
|---|---|---:|---|
| `map_BG9BZP6NRDTEH1JYNDFGS6S3T5` | 開発 (DEFAULT) | 444 | M3E ベータ開発の DEV マップ |
| `map_10226A7F0MEKDVNMEXC7HH4GNV` | 研究 (SECONDARY) | 1 | 研究用、ほぼ空 |
| `alglibmove` | AlgLibMove | 1027 | dogfood 用、2026-04-16 commit で import |
| `rapid-sample` | サンプル | 4 | 動作サンプル |
| `safety-valid-post` | — | 3 | E2E テスト生成物 |
| `safety-docid-roundtrip` | — | 3 | E2E テスト生成物 |
| `safety-doc-one` | — | 3 | E2E テスト生成物 |
| `safety-doc-two` | — | 3 | E2E テスト生成物 |
| `safety-survive-empty-post` | — | 3 | E2E テスト生成物 |
| `safety-survive-null-post` | — | 3 | E2E テスト生成物 |
| `safety-map-update-flow` | — | 4 | E2E テスト生成物 |
| `safety-map-update-erase-guard` | — | 1 | E2E テスト生成物 |

Label は DB には保存されておらず、`start_viewer.ts` のハードコード定数で解決される（`DEFAULT_MAP_LABEL="開発"`, `SECONDARY_MAP_LABEL="研究"`）。

## 未解決の問い

「個人の ws を機能ごとに分けたはず」という認識と、実データ（ws=1、map=複数）にズレがある。以下のどちらの意図だったか要確認:

- (a) **map を複数作ったこと**を ws 分割と呼んでいた → 既に実装済み、上の表の通り
- (b) **workspace 自体を複数**にしたかった（例: 開発用 ws / 研究用 ws / alglibmove 用 ws）→ 未実装、追加実装が必要

## 調査コマンド（再現用）

```bash
# workspace ディレクトリ一覧
ls "C:/Users/Akaghef/AppData/Local/M3E/workspaces/"

# 該当 ws の documents 一覧
cd beta && node -e "
const Database=require('better-sqlite3');
const db=new Database('C:/Users/Akaghef/AppData/Local/M3E/workspaces/ws_REMH1Z5TFA7S93R3HA0XK58JNR/data.sqlite',{readonly:true});
const rows=db.prepare('SELECT id, saved_at, length(state_json) as bytes FROM documents ORDER BY saved_at DESC').all();
for (const r of rows) {
  const st = JSON.parse(db.prepare('SELECT state_json FROM documents WHERE id=?').get(r.id).state_json);
  const nodes = Array.isArray(st?.nodes) ? st.nodes.length : (st?.nodes ? Object.keys(st.nodes).length : '?');
  console.log(r.id, '| nodes:', nodes, '| bytes:', r.bytes, '| saved:', r.saved_at);
}
"
```

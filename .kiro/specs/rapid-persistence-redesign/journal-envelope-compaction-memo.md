# journal の envelope v1 と compaction：現状調査と設計メモ

2026-11-19。状態: 実装担当の設計メモ、未承認。on-disk format に効く一方通行の決定（4 節）は akaghef の回答を待つ。二方向に戻せる点は推奨で仮決めし、実装ログに「仮決め」として残す。

対象: `beta/src/node/record_store/store.ts`（`JournalLine`、`compact()`、`readJournal`、`commitsAfter`、`committedCommand`）、`engine.ts`（engine の catch-up）、`legacy_api.ts`（`storeReadCommittedCommand`）。前提の文書: [sync-principles](sync-principles.md)、[ADR 014](../../../docs/09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md)、[DB 仕様書](../../../docs/03_Spec/Database_Spec.md) 6 節、[実装ログ](implementation-log.md) の 2026-11-19 の journal 関連の項目。

## 1. 現状（dev-beta 3adbf06 で確認）

### 1.1 on-disk layout

- store directory に `snapshot.jsonl`（portable snapshot、1 行目が `{kind:"snapshot", format:1, workspaceId, seq}`）、`journal.jsonl`（WAL。redo-only、1 行 1 commit）、`commit-index.json`（`compact()` が書く。map ごとの最後の commit と、dedupe 用の commandId 直近 100,000 件）。
- journal は workspace ごとに 1 本、writer は 1 process。segment も header も無い。行ごとの format version も無い。
- commit point は journal 行の `write` + `fsync`（`append()`、store.ts:1171）。書きかけの末尾行は open 時に truncate（torn write の後始末）。

### 1.2 `JournalLine` の中身と大きさ

欄: `seq`、`commandId`、`issuer`、`committedAt`、`mapId`、`intent`、`actor`、`provenance`、`changes`（送られた Command の変更。audit・Undo・dedupe の比較用）、`changesHash`、`mapOp`、`newMapId`、`ops`（record に対する put / delete。redo の本体）。

テスト用の一時 store の journal（32 行、91 KB、`/private/tmp/m3e-record-store-*/backups/`、個人 workspace ではない）を数えた結果:

| 欄 | 合計バイト | 比率 |
|---|---|---|
| `changes` | 45,641 | 約 52% |
| `ops` | 38,784 | 約 44% |
| その他すべて | 約 10,000 | 約 11% |

中央値 1.6 KB / 行、最大 36 KB / 行。logical log（`changes`）と physical redo（`ops`）を二重に持っており、どちらかを落とせば行はほぼ半分になる。実データでの測定はまだ（個人 workspace は読まない規則なので、read-only backup の変換結果で後日測る）。

### 1.3 `compact()` の挙動

1. `commit-index.json` を書く（durable write = tmp + fsync + rename）。
2. `snapshot.jsonl` をメモリ上の全 record から書き直す。
3. `journal.jsonl` を空にする。

- crash 順序は正しい（index は snapshot より先行してよい、snapshot が持つ行は open 時に skip）。
- しかし 3 で **journal を破棄する**。akaghef の 2026-11-19 の方向（「journal も出来事の記録も消さず、古い journal は保管へ移す」）と矛盾する。
- どこからも呼ばれていない（`git grep` で test 以外の caller 0 件）。journal は無制限に伸び、open 時の replay も比例して伸びる。

### 1.4 compaction が他の経路に与える影響（今の実装のまま呼んだ場合）

- **engine catch-up**: `commitsAfter(seq)` は `seq < snapshotSeq` で `null` を返し、engine（Neo4j）は `deleteAllRecords` → full rebuild に落ちる（engine.ts:101-106）。compaction のたびに、遅れていた engine は全件再構築になる。
- **committed Command の読み出し**: `committedCommand` は journal を毎回全部読んで線形探索する（O(journal)）。compaction 後は過去の Command の行が消えるので `null`。`storeReadCommittedCommand`（legacy_api.ts:214）経由の audit / Undo が過去を失う。
- **dedupe**: retry の判定は `this.commands`（commandId → seq, hash）で行い、`commit-index.json` に直近 100,000 件だけ残る。これを超えて古い retry は新規 Command として通る。sync-principles の「重複排除の記録は保持期間より長く残す」とは件数で切る点が合っていない。
- **書かれる頻度**: どの commit がどの record に触れたかが消える（実装ログ 2026-11-19 の既存項目）。

### 1.5 文書との関係で分かったこと

- ADR 014 Decision 1 は「workspace × 書き手端末ごとの append-only stream」、sync-principles（2026-11-18、brief より優先）は「確定するのは remote、local の commit は確定ではない」。後者に従えば、**確定済みの journal は remote 上で workspace（将来は scope）ごとに total order の 1 本**であり、端末ごとの列になるのは local の outbox（未確定の Command）の側になる。実装ログ「journal が端末ごとではなく、workspace ごとに一つになっている」は、sync-principles を基準にすると問題ではなく、問題は outbox が無いことの方である。この読み替えは DB 仕様書 2 節の担当（DBスキーマ設計の session）へ回す。

## 2. 設計の原則

- **WAL + checkpoint + segment の三点構成**（PostgreSQL の WAL segment と checkpoint、Kafka の log segment と retention、SQLite WAL の checkpoint に倣う）。snapshot は checkpoint、journal は segment に分けた redo log。
- **消さない**。compaction は「checkpoint を作り、sealed segment を archive へ move する」操作であり、truncate しない。削除は akaghef が別に決める retention の操作（sync-principles の scope ごとの `retention.ms` / `retention.bytes`）であり、compaction と分ける。
- **保存期限と復元期限を分ける**（akaghef 2026-11-19）。保存は全部。replay を保証するのは「最後の format 変更の直後に書いた checkpoint」から後だけ。それより前の segment は「読めるが再生は保証しない」cold archive。
- **version は行ごとに持たない**。segment header と snapshot header の `format` で切り替え点を表す。
- 書き込みは単一 writer、同期 I/O のまま（今の commit path の性質を壊さない）。

## 3. 設計案

### 3.1 on-disk layout（v1）

```
<store>/
  CURRENT                      # 現行 checkpoint の名前 1 行（atomic rename で差し替え）
  snapshots/
    00000000000000012345.jsonl # checkpoint。名前は seq（20 桁 zero-pad）
  journal/
    00000000000000012346.jsonl # segment。名前は firstSeq。最大のものが active
  archive/
    journal/…                  # 現行 checkpoint より前の sealed segment（move、任意で gzip）
    snapshots/…                # 古い checkpoint
  commit-index.json            # dedupe と mapSeq の index（今と同じ役割）
```

- segment の 1 行目は header: `{"kind":"segment","format":1,"workspaceId":…,"firstSeq":…,"prevSegmentTailHash":…}`。
- 旧 layout（`snapshot.jsonl` + `journal.jsonl`）は open 時に読めるようにし、最初の rotation で新 layout へ移す（旧ファイルは `archive/legacy/` へ move）。一度きりの in-place 変換はしない。

### 3.2 envelope v1（journal の 1 行）

| 欄 | 今 | v1 | 理由 |
|---|---|---|---|
| `seq` | あり | あり | total order。remote が採番 |
| `commandId` | あり | あり | idempotency key |
| `issuer` | あり（自己申告） | あり（account の id。認証は別件） | |
| `origin` | なし | **追加**: Command を出した local（端末）の id | sync-principles の「端末」。outbox との照合 |
| `generation`、`historyId` | なし | **segment header に置く**（行には置かない） | remote 作り直しの fencing token。切り替え点だけ持てばよい |
| `committedAt` | あり | あり | |
| `mapId` | 単数 | **`maps`: 触れた map の集合**（単一 map の行は今の `mapId` も残す） | 実装ログ「再送の判定は map ごと」。dedupe key を workspace 単位にする前提 |
| `intent`、`actor`、`provenance` | あり | あり | |
| `changes` | あり | あり（before / after を持つ形に） | logical log。audit・Undo・sync-principles の競合判定（before と after のどちらとも今の値が違うときだけ競合） |
| `changesHash` | あり | あり | |
| `ops` | あり | **任意化**。replay の決定性を試験で保証できたら書かない | 1 行のほぼ半分。保証できるまでは書く |
| `touched` | なし | **追加**: 差分が出た record の key の集合 | 書かれる頻度・足跡の再計算。`ops` を落としても残る schema 非依存の出来事の記録 |
| `prevHash` | なし | **追加**: 直前の行の sha256 | hash chain。remote 作り直しで「連続していて検証済みの最長の部分」を判定する |
| `mapOp`、`newMapId` | あり | あり | |

### 3.3 compaction（checkpoint + rotate + archive）

起動条件（仮決め、二方向に戻せる）:

- commit の後、active segment が **16 MiB** または **20,000 行**を超えたら rotate。
- 現行 checkpoint より後の行が **50,000 行**を超えたら、rotate に続けて checkpoint を作る。
- open 時、replay した行数が同じ閾値を超えていたら、open の最後に checkpoint を作る。
- 時刻での起動（毎晩など）は入れない。量で決まるものを量で起動する。

手順（crash のどの時点でも、open で正しい状態に戻る順序）:

1. **rotate**: active segment を fsync して閉じ（sealed）、`firstSeq = currentSeq + 1` の新 segment を header 付きで作り、directory を fsync。
2. **checkpoint**: `snapshots/<currentSeq>.jsonl` を tmp に書いて fsync、rename、directory を fsync。
3. `commit-index.json` を durable write（今と同じ）。
4. `CURRENT` を tmp + rename で新 checkpoint に差し替え。ここで checkpoint が有効になる。
5. **archive**: 新 checkpoint より前で終わる sealed segment と、古い checkpoint を `archive/` へ rename で move。消さない。format 変更直後の checkpoint は pin（move しない）。

open: `CURRENT` の checkpoint を読み、`journal/` の segment のうち `seq > checkpoint.seq` の行だけ replay。`CURRENT` が無ければ旧 layout として読む。

### 3.4 他の経路の直し

- `commitsAfter(seq)`: `seq < checkpoint.seq` でも、`journal/` と `archive/journal/` の segment が連続して残っていればそこから返す。full rebuild は「segment が欠けている」「format が違う」ときだけ。
- `committedCommand`: `commit-index` の seq から segment を `firstSeq` の二分探索で引き、その segment だけ読む。O(journal) の全読みをやめる。
- dedupe: `commit-index` の件数上限（100,000）を時間ベース（保持期間より長く）に変える案は二方向に戻せるので仮決め: 当面は件数のまま、件数を超えた古い ID は segment を引いて判定する。
- `backupTo`: `CURRENT`、現行 checkpoint、それより後の segment、`commit-index.json` を copy。archive は対象外（別の cold backup）。

## 4. akaghef に決めてもらう一方通行の点（on-disk format）

1. **layout**: 3.1 の `snapshots/` + `journal/` segment + `archive/` + `CURRENT` にするか。推奨: する（PostgreSQL / Kafka と同型で、消さない方針と rotate が素直に書ける）。
2. **`ops` を落とすか**: 推奨: v1 では任意欄にして書き続け、replay の決定性試験が通ったら書くのをやめる（format 番号は上げない。読む側は `ops` が無ければ `changes` を再生）。
3. **hash chain（`prevHash`）を入れるか**: 推奨: 入れる。sync-principles の remote 作り直しの前提で、後から入れると過去の segment に chain が無い。
4. **`touched` を入れるか**: 推奨: 入れる。`ops` を落とした後も書かれる頻度を数えられる唯一の記録になる。後から足すと、足す前の区間は数えられない。
5. **`generation` / `historyId` を segment header に置くか**: 推奨: 置く（行ごとには置かない）。fencing token は切り替え点だけでよい。

二方向に戻せる点（閾値、時刻起動の有無、dedupe の上限、gzip の有無）は推奨で仮決めし、実装ログに残す。

### 4.1 決定済み

- **compaction 後の古い journal の保管期間: 90 日**（akaghef、2026-11-19）。archive へ move した sealed segment は、move から 90 日は必ず残す。90 日は Undo・調査・端末間の同期の遅れを吸収する期間である。
- compaction 自体は何も消さない（2 節）。90 日を過ぎた segment を手放すのは、compaction とは別の retention の操作で行う。この操作は v1 では実装せず、期限を過ぎた segment は archive に残り続ける（消すより残す側に倒す）。手放す前に、その区間を含む checkpoint が archive にあることを確かめる。
- sync-principles の Rapid の保持期間の目安（30 日）とは別の値である。どちらを scope ごとの `retention.ms` の既定値にするかは、DB 仕様書の担当へ回す。

## 5. 実装の順序（決定が出たら codex/<task> worktree で）

1. 旧 layout を読める新 layout の reader（segment header、`CURRENT`）と、その round-trip 試験。
2. rotate と checkpoint（3.3 の 1〜4）。crash 注入試験: 各手順の間で process を止め、open で同じ state と seq に戻ること。
3. archive（3.3 の 5）と、`commitsAfter` / `committedCommand` の segment 対応。
4. envelope v1 の新欄（`origin`、`maps`、`touched`、`prevHash`）。
5. 起動条件の配線（commit 後と open 時）。
6. `ops` の任意化と、replay 決定性の試験（`changes` からの再生が `ops` と同じ record 集合になること）。

試験はすべて `M3E_FORBID_LIVE_DATA=1` と一時 directory で行い、個人 workspace には触れない。

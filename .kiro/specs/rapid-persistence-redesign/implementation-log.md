# 実装ログ（保存・DB）

保存と DB の作業をする agent が、作業の中で得た気づきと見つけた問題を書き込む場所。言われたことをこなすだけでなく、作業で分かったことを仕様と次の作業に活かすために使う。

対象は [DB 仕様書](../../../docs/03_Spec/Database_Spec.md)と、この spec の文書（[record-schema](record-schema.md)、[snapshot-format](snapshot-format.md)、[post-migration-spec](post-migration-spec.md) など）、`beta/src/shared/record_model/`、`beta/src/node/record_store/`、`beta/src/node/neo4j_store/` である。

## 使い方

### いつ書くか

作業の中で、指示の外にあることに気づいたら書く。例を挙げる。

- 仕様と実装の食い違い
- 仕様の穴（決まっていないのに、実装が何かを前提にしている）
- 実データで分かった事実（件数、形の不揃い、大きさ）
- 性能の事実（どこが遅いか、何に比例するか）
- 危険（データが消える、戻せない、黙って壊れる）
- 次の作業を楽にする気づき（再利用できる関数、試験の作り方）

### どこに書くか

- **確かめた事実で、仕様の記述を正す・補うもの**: その仕様に直接書く。たとえば【実装済み】の状態、数値、ファイルの位置がこれに当たる。このログには 1 件立て、扱いを「仕様へ反映」として行き先を書く。
- **決定が要るもの、その作業では直さないもの**: このログにだけ書く。仕様の【決定】の中身を、実装者の判断で書き換えない。決定は akaghef が行う。
- **M3E の map の操作で得た教訓**: `m3e_feedback` に送る（AGENTS.md の規則）。このログには書かない。

### 書き方

- 新しいものを上に足す。1 件は次の形にする。

```
### YYYY-MM-DD 一行の題（何が起きているか）

- 種類: 問題 / 気づき
- 書いた agent: 役割や session の名前（ID は書かない）
- 対象: 仕様の節、file:line
- 中身: 何が分かったか。読んだ人が元を辿らずに分かるように書く
- 根拠: どう確かめたか（実行したコマンド、読んだコード、計測）。確かめていなければ「未確認」と書く
- 扱い: 未対応 / akaghef の判断待ち / 仕様へ反映（行き先） / 実装で解消（commit と、その意図） / 不要（理由）
```

- 解消しても消さない。扱いを書き換える。
- 定義語だけを使う（[Glossary](../../../docs/00_Home/Glossary.md)）。用語の変更の経緯や旧い呼び名は書かない。
- 会話の中の番号（DA1、IB3 など）は、そのまま書かない。中身を文で書く。

### 読む側

- 保存と DB の作業を始める agent は、扱いが「未対応」と「akaghef の判断待ち」の項目を先に読む。
- 自分の作業で解消した項目は、その場で扱いを更新する。

## 記録

### 2026-11-19 圧縮すると、どの確定がどの node に触れたかが失われ、書かれる頻度を作り直せない

- 種類: 問題
- 書いた agent: 物理量と拡張の土台の設計の session
- 対象: DB 仕様書 6 節、`beta/src/node/record_store/store.ts:121`（`JournalLine`）、`store.ts:752`（`compact()`）
- 中身: 圧縮は journal を空にし、`commit-index.json` には map ごとの最後の確定と、確定済みの Command の ID（直近 100,000 件）だけを残す。確定ごとに差分が出たレコードの一覧は残らないので、圧縮より前の書かれる頻度（DB 仕様書 9 節の提案）は作り直せない。記録を始める前の確定は、後から分類できない。akaghef は 2026-11-19 に次の方向を示した。保存期限と復元期限を分ける。journal も出来事の記録も消さず、古い journal は保管へ移す。再生を保証するのは、最後のスキーマ変更の直後に書く snapshot から後だけにする。版は journal の各行に持たせず、切り替えの時点だけを記録する（snapshot の頭の `format` と `seq` で足りる）。出来事の記録は、通し番号・時刻・触れたレコードの ID・出来事の種類だけの、スキーマに依らない形にし、再生できない区間でも数えられるようにする。
- 根拠: DB 仕様書 6 節の圧縮の記述と、`JournalLine` と `SnapshotHeader`（`beta/src/shared/record_model/types.ts:10`）の型を読んだ。
- 扱い: akaghef の判断待ち（復元期限をスキーマ変更だけで区切るか。決まったら DB 仕様書に「器」として書く。上の「journal の畳み込みがどこからも呼ばれていない」の契機の決定と合わせて扱う）

### 2026-11-19 parent edge の形に relationType と attribute の欄が無い

- 種類: 問題
- 書いた agent: 物理量と拡張の土台の設計の session
- 対象: DB 仕様書 3 節の edge の表、`beta/src/shared/record_model/types.ts`（`EdgeConnectionRecord`）
- 中身: 仕様は parent edge が relationType と attribute を持つと決めているが、snapshot の形の `EdgeConnectionRecord` には欄が無い（仕様の表にも注記がある）。parent edge に極性（preserve / invert）を載せる案は、この欄が前提になる。
- 根拠: `EdgeConnectionRecord` の定義を読んだ。
- 扱い: 未対応

### 2026-11-19 名前の接頭辞の規則は MCP でしか検査しておらず、アプリの中から接頭辞の無い名前が書かれている

- 種類: 問題
- 書いた agent: 物理量と拡張の土台の設計の session
- 対象: DB 仕様書 3.8 節、`beta/src/node/layout_capture.ts:50`
- 中身: 新しい attribute 名と relationType に接頭辞を求める検査は、MCP の入口（`beta/src/node/mcp_service.ts`）にしか無い。`layout_capture.ts` は relationType `reference` を接頭辞なしで書く。viewer など他の書き手も検査を通らない。
- 根拠: `git grep '"reference"'` で書き手を探した。他の書き手は網羅していない。
- 扱い: 未対応（既存の名前の対応規則と、確定の側で検査するかを決めてから直す）

### 2026-11-19 attribute の値には型の取り決めが無く、整数と小数を区別できない

- 種類: 気づき
- 書いた agent: 物理量と拡張の土台の設計の session
- 対象: DB 仕様書 3.3 節、10 節、`beta/src/shared/record_model/types.ts`（`JsonValue`）
- 中身: attribute の値は任意の JSON 値で、JSON には整数と小数の区別が無い。拡張の欄（task の status、目標の更新間隔など）の型は、保存の形ではなく、拡張の定義に欄の型を書かせて確定のときに検査するしかない。時刻は今 `committedAt` が文字列で持っている。型の語彙（文字列・整数・小数・真偽・列挙・時刻・期間・node の参照・列）と、時刻・期間の表し方は未決。
- 根拠: `JsonValue`、`NodeRecord`、`JournalLine` の型を読んだ。
- 扱い: akaghef の判断待ち（拡張の仕組みの承認と合わせて決める）

### 2026-11-19 journal の畳み込みがどこからも呼ばれていない

- 種類: 問題
- 書いた agent: Neo4j 化の本線の session
- 対象: DB 仕様書 6 節、`beta/src/node/record_store/store.ts:752`（`compact()`）
- 中身: 正本は「ある時点の portable snapshot と、それより後の journal」で、journal は定期的に portable snapshot へ畳み込む前提である。畳み込みの処理 `compact()` は実装されているが、試験の外からは呼ばれていない。今のままでは journal が増え続け、起動時の再生も長くなる。いつ畳むか（件数、大きさ、時刻、起動時）が仕様で決まっていない。
- 根拠: `git grep` で `compact()` の呼び出しを探し、`beta/src` の試験以外に無いことを確かめた。
- 扱い: akaghef の判断待ち（畳む契機を DB 仕様書 6 節に決める）

### 2026-11-18 何を正本とするかの記述が、二つの文書で食い違っている

- 種類: 問題
- 書いた agent: Neo4j 化の本線の session
- 対象: DB 仕様書 1 節、[ADR 014](../../../docs/09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md)、枝 `codex/sync-principles` の `sync-principles.md`（dev-beta に未統合）
- 中身: DB 仕様書と ADR 014 は「正本は journal と portable snapshot、Neo4j は端末ごとの導出物で、同期も backup もしない」とする。今の実装もこの形である。一方 `sync-principles.md` は「Neo4j は正本エンジンで、他の何かの写しではない」とする。どちらも 2026-11-16 の akaghef の決定（brief の「正本エンジンは Neo4j」）を根拠にしており、「正本エンジン」の読み方が分かれている。このままでは同期・復旧・backup の設計が二通りになる。
- 根拠: 両方の文書の該当行を読んで比べた。
- 扱い: akaghef の判断待ち

### 2026-11-18 attribute をまとめて一つの値で送るため、一部だけ読んだ状態で保存すると読んでいない attribute が消える

- 種類: 問題
- 書いた agent: 描画バグの session（表示の速さの作業）
- 対象: DB 仕様書 3.3 節、5 節
- 中身: node の attribute は、まとめて 1 つの値として書き込まれる。描画に要る項目だけを読む形にすると、保存のときに読んでいない attribute が消える。attribute を 1 項目ずつ書けること、読んでいない部分に触れない保存を仕様として保証することが要る。
- 根拠: その session の調査による。このログの記入時には再確認していない（未確認）。
- 扱い: 未対応

### 2026-11-18 scope の読み出しの大半が、描画に使わない attribute だった

- 種類: 気づき
- 書いた agent: 描画バグの session（表示の速さの作業）
- 対象: DB 仕様書 9 節、10 節
- 中身: scope だけを読む経路で、応答（約 2.1 MB）のほぼ全部が描画に使わない attribute だった。描画に要る項目は node の種別によって違う（たとえば `source-mermaid` を描画に使う種別がある）。そこで、描画に要る項目は node type の定義が宣言する、という要件が出ている。拡張の仕組み（10 節）の定義に、この宣言を持たせる案がある。
- 根拠: その session の計測による。
- 扱い: 未対応（拡張の仕組みの承認と合わせて仕様へ反映する）

# V4 Service-Equivalent Design

更新日: 2026-05-02

## 位置づけ

V4 は、Mapify / Miro / Obsidian / GitHub を外部ツール連携としてぶら下げる計画ではない。
S14 の方針に従い、各サービスが解いている主要機能を M3E の内部能力として取り込む。
S13 の境界により、外部サービスは取得、通知、配布、実行補助として使えても、正本性、採否、復元責任は M3E 側に残す。

今回の縦スライスは、Swingby 公開環境 `ws_team_swingby` 上で次を実行済みの最小実装として扱う。

- PDF を Flash / Mapify 的に取り込み、map node 化する。
- Miro 的な議論結果を同じ map に decision / sticky node として置く。
- Obsidian 的な Markdown vault export / edit / import を行う。
- stale write を 409 conflict として止め、remote state を見た明示 resolution で復旧する。
- GitHub は remote 実操作を急がず、安全仕様を先に固定する。

## サービス別に取り込む能力

### Mapify 相当

目的は、外部資料を一時メモで終わらせず、M3E の構造化 map に変換すること。
V4 では Flash の主要機能として扱う。

MVP:

- PDF / text / markdown を `Flash draft` として ingest する。
- draft は即反映ではなく、承認後に map node へ commit する。
- 取り込み先は明示された target node / scope に限定する。
- 取り込み結果には source metadata を持たせ、あとから出典と変換単位を追えるようにする。

今回の実装確認:

- `scripts/ops/v4_service_slice_demo.mjs` が PDF 先頭ページを抽出。
- `/api/flash/ingest` と `/api/flash/draft/:draftId/approve` で `map_team_swingby_v4_slice_260502` に commit。

### Miro 相当

目的は、視覚的な議論、付箋、decision cluster、レビューの場を M3E の surface と node 属性で扱うこと。
外部 Miro を正本にしない。

MVP:

- sticky / discussion / decision / question を node type または attribute として表現する。
- 同じ map 上で参加者ごとの議論結果を merge できる。
- 重要な議論結果は decision node として固定し、後続の仕様や作業に接続する。
- 将来の canvas 表示は surface の presentation であり、正本は map state。

今回の実装確認:

- host 側の `Miro sticky` / `host Miro decision` を同じ map に追加。
- stale VM edit と競合した場合も、host decision を remote state として保持。

### Obsidian 相当

目的は、local-first な Markdown vault 操作と M3E map を往復できるようにすること。
通常正本は SQLite workspace だが、明示的な local-file binding mode では vault 側を作業面として扱う。

MVP:

- map を Markdown vault に export する。
- vault の編集を import し、M3E map に戻す。
- import 前後に recovery point / conflict backup を作る。
- stale import は silent overwrite せず、conflict として明示する。

今回の実装確認:

- `/api/vault/export` で `docs/for-akaghef/v4_demo/obsidian_vault` に export。
- vault 側 `.md` を編集し、`/api/vault/import` で戻した。

### GitHub 相当

GitHub だけは注意深い設計が必要。
V4 MVP では、remote 操作の多機能化より先に M3E 内部の安全モデルを固定する。

基本方針:

- `git add` という UX は出さない。
- M3E では working change を常に staged proposal として扱う。
- publish / push / PR 前に、M3E が secret lock を確認する。
- 機密を含む node、vault file、attachment、env-like text は remote 対象から除外または lock する。
- Akaghef PC が動いている間は、Akaghef PC 上の local workspace を正本として運用する。
- remote GitHub は配布、履歴、レビュー、復元補助であり、通常時の正本ではない。
- destructive history rewrite、force push、secret exposure risk は人間確認なしに実行しない。

MVP で実装すべき UI / model:

- `proposal/staged/locked/published/conflicted` の状態を node / change unit に持たせる。
- secret lock された item は publish plan から見えるが、内容は出さない。
- GitHub sync は M3E command と audit log に残す。
- conflict は `local truth`, `remote proposal`, `resolution` の3面で見せる。

## 縦スライス受け入れ条件

2026-05-02 時点の合格条件:

- Swingby 公開 URL 経由で demo map が開ける。
- PDF から Flash draft を作り、map に承認反映できる。
- 議論 node を追加できる。
- Obsidian vault export / edit / import が通る。
- stale write が HTTP 409 で止まる。
- remote state を見た resolution save 後、host edit と resolution edit が両方残る。
- 報告 HTML は、実際の M3E 画面 snapshot と状況 pane の2画面だけで見られる。

実行コマンド:

```powershell
scripts\ops\v4_service_slice_demo.bat --publicBase https://akaghef-dell.tail6206ae.ts.net
```

成果物:

- `docs/for-akaghef/v4_demo/260502_v4_service_slice_report.html`
- `docs/for-akaghef/v4_demo/v4_service_slice_summary.json`
- `docs/for-akaghef/v4_demo/assets/v4_service_slice_m3e.png`
- `docs/for-akaghef/v4_demo/obsidian_vault/`

## 次の実装順

1. Flash / Mapify の取り込み単位に source metadata と undo/recovery point を付ける。
2. Miro 相当の discussion / decision node type を viewer UI から作れるようにする。
3. Obsidian import の conflict UI を人間が選べる形にする。
4. GitHub の staged proposal / secret lock / publish plan を UI と model に追加する。
5. VM から同じ V4 slice を起動し、host と VM の同時編集を再現する。

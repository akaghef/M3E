# Cloud Sync 周辺の設計論点 (2026-04-19)

VM × 本体の手動 sync 検証プラン ([C:\Users\Akaghef\.claude\plans\steady-kindling-floyd.md](../../.claude/plans/steady-kindling-floyd.md)) を組む過程で surface した、検証手順の外にある設計論点を pool する。実装判断はここで決めない。akaghef が後で優先度をつけて拾う想定。

前提: `beta/src/node/cloud_sync.ts` は Supabase transport + FileTransport。map 単位で state を push/pull、mapVersion で衝突判定、conflict-backups にローカル state を吐く。

---

## A. 同期モデル

### A-1. auto-pull が無い
`M3E_AUTO_SYNC=1` は push のみ interval 実行、pull は起動時 1 回。2 端末同時編集で自動収束しない (両者が自分の version だけ見続ける)。

- 案 1: pull も interval で実行。ただし未保存 local 変更があるときの silent overwrite 回避の設計が必要
- 案 2: Supabase Realtime (Postgres WAL) を subscribe して変更通知で pull
- 案 3: "Cloud changed" バッジを出して手動 pull を促す (UX 保守派)

暫定推奨: 案 3 → 案 2。

### A-2. 衝突粒度が map 単位
別サブツリーを触っただけでも `mapVersion` 競合で衝突扱い。

- 案 1: 3-way merge (base state を保持、node 単位で diff 結合)
- 案 2: CRDT (Yjs / Automerge)。ただし parent/child ordering・collapsed flag・attributes の扱いに設計工数
- 案 3: 現状維持 + conflict UI 強化 (subtree diff preview / 選択マージ)

暫定推奨: solo 前提なら案 3 十分。チーム化前提で案 1 を設計開始。

### A-3. clock drift 耐性
`savedAt` は client local timestamp。VM とホストの時計ズレで false conflict / false non-conflict が起きうる。

対策: Supabase 側 `updated_at` をトリガで server-authoritative 化、client 時刻は参考値。

---

## B. プライバシー・セキュリティ

### B-1. policy_privacy.md との齟齬 (blocker 候補)
方針: 機密性の高いコンテンツは平文で残してはいけない。
現実: cloud_sync は state を平文 JSON で Supabase に push している可能性が高い (envelope 暗号化の形跡なし)。

- 短期: VM テストは **ダミー map のみ**で実施。実データ map は含めない運用ルール化
- 中期: client-side encryption envelope
  - 案: map ごとに sync_key (パスフレーズ派生 or 端末間で手動共有) → push 前 AES-GCM → ciphertext + IV のみ Supabase へ
  - 副作用: server 側で diff 不可、search 不可。ポリシー優先なら許容

### B-2. Supabase RLS の現状確認 (blocker 候補)
anon key は実質 public。RLS が効いていないと誰でも maps テーブルを読める。

- TODO: Supabase dashboard で `maps` テーブルの RLS policy を確認
- solo 前提を維持するなら `auth.uid()` ベースの policy + Supabase auth (email magic link) で本人限定化

### B-3. device identity の不在
device_id 無し。どの端末が原因の衝突か追跡不能。UX 上「最後に編集したのは laptop / VM」を出せない。

- 案: 起動時に `%LOCALAPPDATA%\M3E\device.id` (UUID v4) 生成、push に同梱、Supabase `maps.last_device_id` に記録
- 副次: 同一 device の連続 push を conflict 扱いしない最適化が可能

---

## C. 運用・ストレージ

### C-1. conflict-backups の無限肥大
`final/data/conflict-backups/` に既に 4 件。テスト繰り返しで数百件になる。回転ポリシー未定。

- 案: 最新 50 件 or 30 日超で自動削除、削除前に archive zip。

### C-2. version history
`maps` 1 行 overwrite。rollback 不能。

- 案: `map_versions (map_id, version, state, committed_at, device_id)` を別テーブルに append。UI で "restore to version N"
- コスト: Supabase storage 増 (10-100KB × push 回数)

### C-3. map 単位 opt-in / opt-out
`M3E_CLOUD_SYNC=1` で全 map が対象。"この map だけ cloud" / "この map は local only" をやりたい。

- 案: `map.attributes.cloud_sync=yes|no` を map 自身に持たせ、home 画面で bulk toggle。

### C-4. credentials の持ち方 (部分解決済)
`scripts/final/launch.bat` が `M3E_CLOUD_*` / `M3E_SUPABASE_*` を `m3e.conf` からも読む構成に更新された。残課題:

- `m3e.conf` は平文。OS ACL 依存。機密性が要るなら DPAPI 経由暗号化 (`%LOCALAPPDATA%\M3E\cloud.enc`) を検討
- 初回 launcher で UI 入力させて `m3e.conf` に書き込むフローは未整備

---

## D. スケール・ネットワーク

### D-1. 全 state push
毎回 map 全体 JSON。1000+ node で帯域・DB 書込量が線形増加。

- 案: delta push (前回 base からの diff operations)。A-2 の 3-way merge と同時設計

### D-2. offline queue
オフライン中の push 失敗は失敗表示のみ。復旧後 auto-retry 無し。

- 案: `%M3E_DATA_DIR%\cloud-pending\` に pending JSON を溜め、オンライン復帰検知で順次 retry

### D-3. Supabase Realtime
A-1 の筋のいい解。Postgres WAL subscription で他端末 push を即検知。

- コスト: @supabase/supabase-js の realtime モジュール組込み、server proxy の有無判断

---

## E. テスト戦略

### E-1. E2E 自動化 (Playwright)
今回の手動手順を Playwright で自動化:
- 本体 node + 隔離 M3E_DATA_DIR の 2 つ目 node を同一 OS で立ち上げ
- 2 つの Playwright browser で同時操作
- Supabase は mock (in-memory REST stub) or dev project

### E-2. 既存 unit test のカバレッジ穴
- `cloud_sync_conflict.test.js` は HTTP レイヤのみ。UI 側 `cloudUseLocal` / `cloudUseCloud` の挙動未テスト
- auto-sync interval の drift / pause 時挙動未テスト

### E-3. Supabase schema 回帰テスト
schema を migrations/ 管理、CI で `supabase db reset` + sync tests。

---

## F. ポリシー / 仕様判断事項 (akaghef 決定待ち)

1. **solo か チームか**: project_cloud_sync_solo.md は solo 前提。チーム拡張なら B-2 RLS + auth が前提条件
2. **Cloud に何を置くか**: 研究メタのみ? 本文込み? → B-1 encryption の要否が決まる
3. **Realtime 体験 vs バッテリー**: 常時 subscription はモバイルに厳しい。デスクトップ前提なら許容
4. **facet 単位 sync の要否**: facet = PJ の一側面 (project_facet_concept.md)。同期粒度を facet に揃える案もあるが、複雑化するため現状 map 単位で十分と判断

---

## 優先度仮置き

### VM テストを実データで走らせる前に決める (blocker)
- F-2 (cloud に何を置くか)
- B-2 (RLS の現状確認)

### VM テストと並行で検討できる (nice-to-have)
- A-1 (Cloud changed バッジ or auto-pull)
- C-1 (conflict-backups 回転)
- A-3 (server-authoritative timestamp)

### 将来 PJ として切り出す (out of scope)
- A-2 / D-1 (3-way merge + delta sync)
- C-2 (version history)
- D-3 (Realtime)
- E-1 (E2E 自動化)

---

## 関連ファイル

- [beta/src/node/cloud_sync.ts](../beta/src/node/cloud_sync.ts)
- [beta/src/node/conflict_backup.ts](../beta/src/node/conflict_backup.ts)
- [beta/src/browser/viewer.ts](../beta/src/browser/viewer.ts)
- [scripts/final/launch.bat](../scripts/final/launch.bat)
- [scripts/ops/launch-cloud-sync-template.bat](../scripts/ops/launch-cloud-sync-template.bat)
- plan file: [C:\Users\Akaghef\.claude\plans\steady-kindling-floyd.md](../../.claude/plans/steady-kindling-floyd.md)
- policy: memory/policy_privacy.md
- policy: memory/project_cloud_sync_solo.md

# System Diagram Demo — runbook

- **status**: authoritative (T-8-4)
- **phase**: 8 (Plan 3 / Plan CD)
- **purpose**: PJ03 map の System Diagram subtree を timed command replay で段階的に構築し、viewer 上で「システム図が育つ」様子を観察できる demonstration の再生手順

## 事前準備チェックリスト（3 分）

```bash
# 1. branch / working dir
cd c:/Users/Akaghef/dev/prj/03_SelfDrive
git checkout prj/03_SelfDrive

# 2. beta build
cd beta
npm install --silent
npm run build:node
cd ..

# 3. map server health + PJ03 map 存在確認
curl -s http://localhost:4173/api/maps | python -c "import json, sys; d = json.load(sys.stdin); pj03 = [m for m in d['maps'] if m['label']=='PJ03']; print('PJ03 map:', pj03[0] if pj03 else 'NOT FOUND')"
# 期待: {'id': 'map_xxx...', 'label': 'PJ03', ...}
```

端末 2 つ用意推奨:
- 左: command 実行
- 右: viewer（http://localhost:4173/ を開き、PJ03 map を選択、System Diagram subtree を展開表示）

## 再生 3 モード

### 安全ポリシー（重要）

- `--live` を付けない限り **dry-run がデフォルト**。map server に触れない
- script に destructive command (`reset_subtree`) が含まれるとき、`--live` は `--backup-dir <dir>` を必須
- map 一致チェックは **exact match**（script の `map_label_expected` と map の `root.text` 完全一致、substring 不可）
- pre-run snapshot が backup-dir に JSON で書かれる（`map-<id>-<timestamp>.json`）

### モード A: dry-run（安全確認、デフォルト）

```bash
cd beta
node dist/node/system_diagram_runner.js \
  --script ../projects/PJ03_SelfDrive/artifacts/system_diagram_pj03.json \
  --auto --interval 0
```

**用途**: viewer に触れず、31 command の実行順だけを確認。demo 直前の sanity check。`--dry-run` フラグは冗長で不要。

### モード B: step（手動 pacing、live）

```bash
cd beta
node dist/node/system_diagram_runner.js \
  --script ../projects/PJ03_SelfDrive/artifacts/system_diagram_pj03.json \
  --live --backup-dir ../projects/PJ03_SelfDrive/artifacts/backups \
  --step
```

**用途**: 1 command ごとに Enter で進める。聴衆とディスカッションしながら「次は何が起きるか」を解説できる。観衆がいるライブ demo に向く。

### モード C: auto（自動再生、live）

```bash
cd beta
node dist/node/system_diagram_runner.js \
  --script ../projects/PJ03_SelfDrive/artifacts/system_diagram_pj03.json \
  --live --backup-dir ../projects/PJ03_SelfDrive/artifacts/backups \
  --auto --interval 500
```

**用途**: script 内 delay_ms + --interval 500ms で自動 pacing。録画や自己確認に向く。**このパラメータで 31 step の完走は約 30〜40 秒**（audience demo の想定 pacing）。

> 開発中の structural verification 用に `--interval 20` のような速走も可能だが、audience 用 runbook としては 500ms が canonical。

## 観察ポイント（viewer で見るべき箇所）

| タイミング | 画面で何が起きる |
|---|---|
| cmd-001 | System Diagram anchor が作られる（既存があれば clear される） |
| cmd-010〜013 | Inputs / Sources が生え、tasks.yaml / checkpoints / reviews の 3 子が並ぶ |
| cmd-020〜025 | Runtime Layers が生え、reducer / orchestrator / clock_daemon / graph_runtime / cli の 5 子が並ぶ |
| cmd-030〜032 | Projection To M3E が生え、projector / snapshot が並ぶ |
| cmd-040〜044 | Boundary Rules が生え、SSOT / one-way / human contract / fail-closed の 4 rule が並ぶ |
| cmd-050〜054 | 5 本の link が順に張られ、Inputs→Layers→Projection の矢印と Rules→Layers / rules→各 input/proj の governs 矢印が浮かぶ |
| cmd-060〜063 | 4 section が section 色（Inputs=水色 / Layers=橙 / Projection=緑 / Rules=ピンク）で塗られる |
| cmd-070〜072 | 3 key leaf node（reducer / checkpoint input / one-way rule）に importance=high が付く |

## 失敗時対応

- **map server 不在**: curl で 200 が返らない → `scripts/beta/launch.bat` 等で viewer を起動
- **`--backup-dir was not provided` エラー**: destructive script を `--live` で走らせる時は必須。`--backup-dir ../projects/PJ03_SelfDrive/artifacts/backups` を追加
- **`map_label_expected exact match required` エラー**: PJ03 map の root.text が "PJ03" と完全一致していない（旧い map を指している等）。map_id と root.text を確認、必要なら script の `map_label_expected` を現状と合わせる
- **reset_subtree で anchor parent not found**: PJ03 map root id が変わった場合。script の `anchor_parent_id` を最新 root id に更新
- **途中 HTTP 4xx/5xx**: runner は失敗コマンドで停止する（後続未実行）。map の状態はそこまで書き込み済み。**pre-run snapshot** が `artifacts/backups/` にあるのでそれを POST で戻すか、`cmd-001 reset_subtree` で再度 clean 化して再実行可能

## 成功基準との対応

plan3.md §成功基準:

| 基準 | 本 runbook で達成 |
|---|---|
| 最小: PJ03 System Diagram を script で再構成 | モード A (dry-run) + モード C (auto live) で 31 command 完走 |
| 最小: runner が timer 付きで順次実行 | script delay_ms + --interval、モード C で自動 pacing |
| 最小: viewer 上で図の成長を観察 | モード B / C 実行中に viewer で節/リンク/色が順次現れる |
| 中間: link / attr / color で図として意味が出る | cmd-050〜072 で link 5 本 + section 色 4 + importance 3 |
| 中間: 同 script 再生で同構造 | reset_subtree + 固定 node id により冪等 |
| 最終: 将来 demonstration skill の基底方式を説明できる | 本 runbook + plan3.md §将来への接続 参照 |

## 将来への接続（plan3.md §将来への接続）

本 demo で確立した pattern:

1. **command schema** (beta/src/shared/system_diagram_command_types.ts) — 6 command で minimal
2. **timed replay** (system_diagram_runner.ts の auto mode + delay_ms)
3. **execution log** (stdout の [NNN/TOTAL] prefix)
4. **structure assertion** (reset_subtree + 固定 id で冪等性)

将来 universal skill に一般化するときは、これらを map 横断化 / command 型拡張 / 再生ログ永続化 に展開すればよい。

## 関連

- `beta/src/shared/system_diagram_command_types.ts`（T-8-1）
- `beta/src/node/system_diagram_runner.ts`（T-8-2）
- `projects/PJ03_SelfDrive/artifacts/system_diagram_pj03.json`（T-8-3）
- `projects/PJ03_SelfDrive/plan3.md §デモの核`
- `projects/PJ03_SelfDrive/idea/demo_skeleton.md`（PJ03 全体の demo 骨格、本 runbook はその Part 4 に該当）

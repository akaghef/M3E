---
pj_id: PJ08
status: exploring
phase: 1
updated: 2026-09-15
---

# PJ08 plan — M3E × OT 合併吸収

> **ID 系列の注意**: 本ファイルの `DC1`–`DC5` は **PJ08 の決定**であり、
> `ADR_011` の `DC1`–`DC22` とは別系列。ADR 側を指すときは必ず `ADR_011 DC3` と書く。
> 同様に `IS1`–`IS3` は PJ08 のもので、`ADR_011 IS1`–`IS16` とは別。

## TL;DR

論理は揃っている。**完成図が1枚も無い**のが律速。だから Phase 1 は GUI 収束だけに絞り、
DB も agent runtime も作らず静的 mock の採否を閉じる。閉じてから論理・実装へ進む。
散在した6本の worktree は PJ08 が吸収先になる。

## 確定した決定（2026-09-15、akaghef）

| ID | 決定 | 根拠 |
|---|---|---|
| **DC1** | 1枚目の1画面を先に作る。**DB なし・agent runtime なし**の静的 mock | akaghef「完成図、1枚目の1画面もまだ出来上がったものを見ていない」 |
| **DC2** | 中身は「今の M3E surface の描画物」と「OT の描画物」の**安直な合成**でよい。**M3E との識別は目的ではない** | akaghef 明示。Director の「M3E性の受入条件を先に書く」案は却下された |
| **DC3** | multi-PC は新軸ではない。**`.disperse-group` のカテゴリ・ボックス分け仕様に乗せるだけ**。描画ロジック上は無関係 | akaghef「scatterにはカテゴリをボックスで分ける仕様がM3Eにあった」 |
| **DC4** | 器は `projects/PJ08_M3E_OT_Fusion`。既存6 worktree + 停止 spec + 未マージ S17 の吸収先 | akaghef 選択 |
| **DC5** | seam lab 側の GUI 解体・リバースエンジニアリングは既に先行している。**やり直さない** | akaghef「seam labでもGUIの解体、リバースエンジニアリングは先行している」 |

### DC1–DC2 に至った経緯（再発防止のため残す）

2026-09-14、Fugu の RG1 Mock は一般的な業務 dashboard へ退化した。Fugu 自身の診断:

> contract が「6つの task card と6つの agent card がある」しか要求していなかったため、
> 一般的な業務 dashboard へ退化しました。さらに視覚 QA も「崩れていないか」しか見ず、
> 「M3E と一目で識別できるか」を判定していませんでした。

Director（Claude）はこれを受けて「M3E性を反証可能な視覚条件として先に書き下す」を解として
提案したが、akaghef に却下された。**却下理由**: akaghef の不満は「dashboard に似ている」ことでは
なく「完成図を1枚も見ていない」ことだった。Director は9月会話の最初の依頼
（「モックアップのサイトを作ってみて」）に立ち返らず、途中の失敗分析から設計を始めた。

**教訓**: 失敗した agent の自己診断を、そのまま次の解として輸入しない。
依頼の原文に戻ってから設計する。

## 未決論点

| ID | 論点 | 状態 |
|---|---|---|
| **IS1** | **色の所有権。** akaghef「色使いは node type ごとに決まる、global に意味は無い」 vs `color_semantics.md`「map 全体の規約、7色固定」 | `reviews/Q1_color_ownership.md`。mock では **state ring = 7色規約 / 塗り・形 = node type 所有** で暫定分離 |
| **IS2** | **LOD。** 遠景で Agent Card が読めない（`ADR_011 DC22`）。閾値・字送り・固定幅・attention と Actor 多重度の視覚的分離 | Phase 2。`ADR_011 IS4` が「seam lab で目視決定」と指定済み |
| **IS3** | **DECK rail の折返し。** 1080px 未満で rail が surface の下に落ちる。実機幅での確認が要る | Phase 1 の残タスク |

## Phase 設計

| Phase | 目的 | 出口条件（Gate） | 状態 |
|---|---|---|---|
| **1. GUI 収束** | 完成図の1画面を akaghef が見て採否を判断できる状態 | akaghef が mock を承認、または具体的な差し戻し内容を出す | **進行中**（初稿「第一案としては優秀」） |
| **2. node type カタログ** | surface に出る node type ごとに 見た目 / schema / ロジック / 色 / 操作 を確定 | IS1 が決着し、type 別テンプレが再利用可能な形で書かれている | 未着手 |
| **3. connector seam 契約** | OT observation contract → M3E map データ層の seam を exclusive に切る | 実データが M3E map に node として生える | 未着手 |
| **4. 一枚絵 thin slice** | `Goal / Task ── assignment ── Agent ── resource-use ── お金` を同一 graph で結ぶ | `S17.8` の 1–3 が満たされる | 未着手 |
| **5. multi-PC** | 複数 PC + 常駐 mac mini が同一 state を矛盾なく共有 | `S17.8` の 4–6 が満たされる | 未着手 |

Phase 遷移判定は **akaghef のみ**。Claude は判定しない。

## 吸収表 — 散在していた作業の行き先

PJ08 立ち上げ時点（2026-09-15）で OT 関連の作業は6本の worktree と1本の停止 spec に散っていた。
**各々をどう扱うかを決める**のが Phase 1 の副産物。

| worktree / spec | 中身 | 状態 | PJ08 での扱い | 決定 |
|---|---|---|---|---|
| `codex/ot-absorption-strategy` | S17 + idea 2本（`260914_ot_prompt_role_agent_node_orrery_force.md` / `260914_unified_work_graph_multi_pc_resource_ot.md`） | 未マージ、6 files +562 | **最優先で dev-beta へマージ**。S17 が未マージのままだと PJ08 の Strategy 根拠が正本に無い | 要 akaghef 判断 |
| `codex/ot-component-seam-labs` | OT upstream 取り込み（`cut/shared/dashboard.css` 132K、DECK/NETWORK、provenance.json、LICENSE） | 未 commit 差分あり、33 files +9829 | **保持。PJ08 の視覚語彙の一次資料**。`screen01.html` のトークンはここから逐語採取した。Playwright 未実行（Director 依頼のまま） | 保持 |
| `codex/agent-orrery-node-mock` | Fugu の RG1 Mock | 未 commit 差分あり、9 files +201 | **参照のみ。正本にしない**（dashboard へ退化した実物として retrospective に残す） | 参照 |
| `codex/agent-card-lab` | Agent Card + `pet_catalog` + spritesheet 14種 + `shared/agent_card.ts` | 未マージ、22 files +2024 | **Phase 2 の node type カタログへ吸収**。`ADR_011 DC22` の Agent Card 表示要素の実装候補 | Phase 2 |
| `codex/orchestration-board-seam` | spec 3点 + `agent_runtime_monitor.ts` + `orchestration_projection_v0.ts` | 未マージ、18 files +2968 | **Phase 3 の connector seam の先行実装として査読**。runtime observation の既存実装 | Phase 3 |
| `codex/ot-spec-extraction` | 空（dev-beta と同一） | — | **削除候補**。`git worktree remove` | 要 akaghef 判断 |
| `.kiro/specs/agent-orrery-map` | `requirements.md` のみ 37KB（design / tasks / spec.json 無し） | 停止 | **Phase 2–3 で再起動**。requirements は生かす | 再起動 |

> ⚠️ 未 commit 差分を持つ worktree が2本ある。`git worktree remove` を強制しない。
> 削除は akaghef の判断を取ってから。

## 探索ログ

### 2026-09-15 — 現在地の確定

読んだもの: `ADR_009` / `ADR_011`（DC1–DC22, IS1–IS16）/ `ADR_012` / `farthest_goal.md`（RQ1–RQ6,
RK1–RK4）/ `color_semantics.md` / `codex/ot-absorption-strategy` の S17 / 9月の Claude セッション
`c37bb36e` / Hermes packet `001_20260914_082443_a71149`。

判明したこと:

- **論理層はほぼ揃っている。** ADR_011 は IS1–IS16 のうち 10 件を DC で解決済み。
- **connector は未実装。** `farthest_goal.md` のスナップショットどおり、M3E 内に上流参照コード 0 件。
- **視覚語彙の一次資料は既にある。** `ot-component-seam-labs` に OT の `dashboard.css` が逐語で入っている。
- **akaghef が挙げた「OTより劣化している」具体点は2つ。** 「edge から mail 履歴を見れる」
  「node ホバーで情報が現れる」。これは比較評価なので**そのまま合格条件に使える**。

### 2026-09-15 — mock 初稿

`mocks/screen01.html` を提出。akaghef「第一案としては優秀だ」。

トークンは**逐語採取**（発明しない）:

| 出所 | 採ったもの |
|---|---|
| OT `beta/src/labs/ot/cut/shared/dashboard.css` | `--void:#080a0c` / `--bone:#ece2cc` / `--amber:#ffb02e` / `--cyan:#36e8ff` / `--alert:#ff4d3a`、CRT scanline + vignette、command bar、gauges、DECK card、`IBM Plex Mono` + `Chakra Petch` |
| M3E `beta/viewer.css`（`body.scatter-surface-active`） | 地 `#0a0a12`、node `#60a5fa`、group `#818cf8`、guide `rgba(56,189,248,.46)`、`.disperse-group` の破線ボックス `#5f7fad` / `dasharray 6 4` |
| `.kiro/steering/color_semantics.md` | state 7色を意味名トークン化（`--st-normal` 他） |

両者がすでに暗色なので単一テーマで合成できた（これは偶然ではなく、M3E の scatter surface が
`#0a0a12` を選んでいたため）。

実装した interaction grammar（akaghef の劣化指摘 2件に直接対応）:

- node hover / focus / click → 右 rail の detail card が入れ替わる
- typed edge click → 下の Edge Inspector に mail 履歴。履歴が無い edge は「typed relation のみ」と明示

node type ごとに形を変えた: goal ◇ / task ▭+左ストライプ / gate ⬡ / deliverable 角折れ /
resource ○¥ / AI agent ○ / human □。**ただし state ring は同型**（`RQ2` 対称性: map に
「人間の欄」と「AIの欄」を作らない）。観測不能は破線 + 白（`color_semantics` 規則3）。

## 実行計画（Phase 1 の残り）

1. akaghef の差し戻し内容を受けて `screen01.html` を改訂（**T1**）
2. IS3（DECK rail 折返し）を実機幅で確認（**T2**）
3. IS1（色の所有権）を `reviews/Q1` で akaghef に問う（**T3**）
4. `codex/ot-absorption-strategy` のマージ可否を akaghef に問う（**T4**）
5. Gate 1 判定を akaghef に依頼（**T5**）

## 進捗ログ

| 日付 | 内容 |
|---|---|
| 2026-09-15 | PJ08 立ち上げ。DC1–DC5 確定、IS1–IS3 起票。mock 初稿提出・好評。吸収表作成 |

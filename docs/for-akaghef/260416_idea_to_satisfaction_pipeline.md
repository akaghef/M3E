# アイデア → ユーザー満足までの導線（dump）

2026-04-16 ダンプ。後で詰める前提。
ブレストではなく、方針を一本に絞っていく作業の出発点。

## 問題設定

- `idea/` 配下に 17 カテゴリ × 約 116 ファイル × 数百論点が積まれた
- このままでは **読みきれない／採否できない／実装に降りない**
- AI を前提に、論点プールから「akaghef の満足」までを繋ぐ導線が要る
- 「満足」の最終定義は project_projection_vision（2026-10 に科研費等を出力できる実用化）

ゴールは「116 ファイルを 1 本のパイプラインに乗せる」こと。
コンセプトレベルで 5 層 + 戻りループで成立する見込み。

## 全体構造

```
[Pool] → 1.Index → 2.Score → 3.Triage → 4.Compile → 5.Build
                                            ↑
                                 [Dogfood] ← Loop (満足度・学び)
```

5 層は **直列だが、Index と Score はバッチ・残りは継続運用** という非対称な負荷分布。
これを混同すると「毎回全部やる」破綻に陥る。

---

## Layer 1: Index（機械可読化）

**やること**: `idea/` 配下の論点を 1 つの機械可読な索引にする。

- 単位: 論点 ID（A1.1 / B2 / J3.A 等、各ブレストで既に振った）
- 形式: `idea/_index.json`（または .jsonl）
- フィールド:
  - `id`, `category`, `title`, `file`, `summary`（AI 生成、1〜2 行）
  - `cost_estimate`（行数・日数のオーダー）
  - `impact_estimate`（projection_vision 寄与度 0〜3）
  - `dependencies`（他論点 ID）
  - `related_existing_code`（既存ファイルへの参照）
  - `related_memory`（feedback_*, project_*, policy_*）
  - `status`（pool / scored / triaged / building / done / no）

**AI の関与**: ほぼ全工程。バッチで一度走らせる。
**人間の関与**: 走らせる判断、抜け／誤分類のスポット修正。

**注意**:
- 論点 ID 体系がブレスト間で揃っていない（A1.1 階層型 vs M01 連番型 vs 単一文字型）→ Index 化時に正規化する
- 116 ファイルの再読込コストは大きいので、ファイル単位ではなく **section 単位の差分更新** を最初から想定する

## Layer 2: Score（評価）

**やること**: 論点に Impact / Cost / Fit の 3 軸スコアを振る。

- **Impact**: projection_vision (科研費 2026-10) への直接寄与度
  - 直結（B2 申請書テンプレ・H4 Zotero・H5 LaTeX 等） → 高
  - 間接（D 整理・G 観察・I 振り返り） → 中
  - 遊び・哲学（K, P, Q） → 低（ただし「離脱防止」価値はある）
- **Cost**: 既存資産活用度を割引いた実装コスト
  - 既存 `backup.ts` `audit_log.ts` `ai_subagent.ts` `collab.ts` 等を流用できるか
  - C, E, I, F の各ブレストが「既存資産で 70% カバー」と独立に報告 → 信頼してよい
- **Fit**: 既存メモリ・原則との整合
  - policy_privacy（暗号化必須） → L 系・公開系で減点
  - feedback_no_interpretation → AI 自走系（C10 等）で減点
  - feedback_dev_map_size → 巨大マップ前提機能で減点

**スコアの使い方**:
- 単純な総和ではなく、**Impact 高 × Cost 低 × Fit 高** が重なるものを優先候補に
- 「クラスタ化」も同時に: Zotero (H4) + LaTeX (H5) + 申請書 (B2) + 複利構築 (J3) のような **横断束** を AI が抽出する
- スコアは絶対値ではなく **相対順位** だけ信頼する

**AI の関与**: スコアリング自体（人間より一貫性が高い）。
**人間の関与**: スコア基準の合意（一度決めれば固定）、外れ値のレビュー。

## Layer 3: Triage（採否の高速化）

**やること**: 論点 ID 単位で Now / Soon / Later / No に振り分ける。

- 既存 keyboard_modes M02 review mode をそのまま流用
- AI は事前に推奨を提示（「J3.A: Now 推奨、理由: B2 と束で効く」）
- 人間は **1 キーで確認だけ**: `1` Now / `2` Soon / `3` Later / `0` No
- 1 セッション 30〜60 分、月次のリチュアル化（personal_productivity G2 と統合）

**No の扱いが特に重要**:
- 「やらない」を明示記録（automation_obstacles N15）
- 後から AI が定期的に再浮上させる（採用バイアス回避）
- No 理由を 1 行残す（「他で代替可能」「機微度高すぎ」「研究核心を侵食」等）

**Now の上限**:
- 同時 Now は 3〜5 論点まで（実装ブラックホール回避）
- 超えそうなら Soon に降ろす

**AI の関与**: 推奨提示、棄却理由分類、再浮上スケジューリング。
**人間の関与**: 最終判断（必ず人間、automation_obstacles N10）。

## Layer 4: Compile（実装スペック化）

**やること**: 採用論点 ID 群 → 実装可能な単一スペック。

- AI が論点群を読み込み、以下を生成:
  - 既存ファイルへの diff 案（`viewer.ts` 等）
  - 必要な新ファイル
  - データモデル変更（attribute 追加・新フィールド）
  - テスト観点
  - ロールバック手順
  - 1 週間 MVP のスコープ
- 出力先は `docs/for-akaghef/<date>_spec_<topic>.md`

**重要な制約**:
- 1 スペック = 1〜2 週間で実装完了できる規模に絞る
- 超える場合は「Phase 1 / Phase 2」に分割し、Phase 1 だけを Build に流す
- 横断束（例: B2 + J3 + H4 + H5）は **共通基盤を先に Phase 0 として切り出す**

**AI の関与**: 既存コード解析、スペック起草、impact/risk セクション。
**人間の関与**: スコープ確定、優先順位の最終決定、未決質問への回答。

## Layer 5: Build（subagent 委譲）

**やること**: スペックを既存 subagent 体制に流し込む。

- visual / data / team の 3 subagent に役割分担
  - visual: viewer.ts, CSS, SVG, UX
  - data: rapid_mvp.ts, データモデル, API
  - team: collab.ts, cloud_sync.ts
- maintenance_hygiene D の検出器を Agent Status と統合
  - Stale な実装中ノード（着手から 7 日経過 etc）を AI が監視
  - 詰まっている subagent を可視化
- 既存 feedback_agent_status_routine（Agent Status 更新義務）を拡張

**AI の関与**: 実装本体（subagent）、進捗監視、stale 検出。
**人間の関与**: マージ判断、最終提出ボタン（automation_obstacles N10）、PR レビュー。

## Loop: Dogfood → Pool 戻し

**やること**: 実装後 1〜2 週間使った結果を Index に書き戻す。

- 良かった → 関連論点（dependencies の逆方向）も Now に昇格
- 微妙 → 「ここが微妙だった」を学習素材として記録（idea 内に追記、新ブレストの種）
- 不要だった → No 宣言を Index に書き戻し、なぜ不要だったかも記録

**満足度の測り方**（暫定）:
- 主観: 「使ってる頻度」「ストレス減ったか」「研究が進んだ感覚」
- 客観: m3e 操作ログ、commit 数、書いたノート量
- 半年指標: 2026-10 時点で科研費申請書がドラフトできているか

**AI の関与**: 操作ログ集約、満足度ヒアリング（週次プロンプト）、Index 自動更新案生成。
**人間の関与**: 主観評価、最終的な「満足／不満」判定。

---

## AI の役割マトリクス

| Layer | AI の主な役割 | 人間の主な役割 | 自動化レベル |
|---|---|---|---|
| 1 Index | 全部 | 起動と外れ値修正 | L4（事後監査）|
| 2 Score | 全部 | 基準合意 | L3（事前合意済み） |
| 3 Triage | 推奨 | 1 キー判定 | L2（複数案提示）|
| 4 Compile | 起草 | スコープ確定・未決回答 | L1（下書き、人が編集）|
| 5 Build | 実装本体 | マージ・提出 | L3（AI 実行、人が監査）|
| Loop | 集約・更新案 | 主観評価 | L2 |

**レベル定義は automation_obstacles P2 の段階的自動化に準拠**。
全体として L1〜L3 を行き来する設計で、L4 は Index と Score だけ。
これが「AI 前提だが核心判断は人間」の実装パターン。

## 「ユーザー満足」の定義（暫定）

3 段階に分けて持つ:

1. **短期（1〜2 週間）**: スペック通りに動く・既存ワークフローを壊さない
2. **中期（1〜3 ヶ月）**: 月次レビューで「これがあって助かった」と言える機能が増える
3. **長期（半年）**: project_projection_vision 達成（科研費等の出力ができる実用域）

短期は機械的に判定可能（テスト・動作確認）。
中期は personal_productivity G2 週次レビューで自己申告。
長期は projection_vision の単一指標。

**「満足」の罠**:
- 機能追加したから満足、ではない
- 「使わなくて済むようになった」が最高の満足（automation_obstacles P20）
- だから Triage の `0 No` 宣言も満足の一形態として扱う

## 既存資産との接続

このパイプライン自体、ほとんど既存資産で組める:

| 必要なもの | 既存資産 | 不足 |
|---|---|---|
| Index ストア | m3e-map.json 構造 | _index.json 仕様策定 |
| Score バッチ | ai_subagent.ts | スコア基準の文書化 |
| Triage UI | keyboard_modes M02 review mode | 専用画面（または scope 機能流用）|
| Compile | 既存 docs パターン | スペックテンプレ |
| Build | visual/data/team subagent | 既に運用中 |
| Stale 監視 | maintenance_hygiene D（未実装） | 検出器実装 |
| 操作ログ | audit_log.ts | 集約・分析 |
| 振り返り | personal_productivity G2（未実装）| 儀式化と UI |

**最初に作るべきは Index 化**。これがないと 2 以降が立ち上がらない。

## 落とし穴と対処

### F1. 採否疲れ
- 116 論点を毎回考えるのは破綻
- 対処: AI 推奨 + 1 キー triage + 月次バッチ化

### F2. 実装ブラックホール
- 1 論点が肥大化して終わらない
- 対処: 1 スペック = 1〜2 週間以内、超えたら Phase 分割

### F3. 採用バイアス
- 馴染みのあるカテゴリばかり採用される
- 対処: AI が「却下されがち」「触れられていない」論点を定期再浮上

### F4. メタ過剰
- パイプライン自体の整備に時間を使いすぎる（meta_m3e Mt-H5）
- 対処: パイプラインも MVP 単位で組む。Index → Score → Triage を最小実装してから残りに投資

### F5. 満足の取り違え
- 「機能が増えた」を満足と誤認
- 対処: 「使わなくて済んだ」「邪魔にならない」も満足として記録

### F6. AI 信頼の過剰／過少
- スコアを鵜呑み or 全部疑う
- 対処: スコアは相対順位だけ信頼、絶対値は無視

### F7. Index の腐敗
- 論点を追加・修正しても Index が更新されない
- 対処: 各 idea ファイル更新時に Index 再生成を git hook 化（要検討）

### F8. No 宣言の死蔵
- 「やらない」が永久 No になる
- 対処: 半年ごとに No を見直すリチュアル

---

## 次のアクション（candidates）

「とりま」段階なので、決めずに並べる:

- N1. Index 仕様策定（フィールド・形式・更新方針）
- N2. 116 論点を試しに 1 カテゴリだけ Index 化してみる（パイロット）
- N3. Score 基準の合意（特に Impact の重み付け）
- N4. Triage UI を keyboard_modes M02 で試作するか専用画面を作るか
- N5. このパイプライン自体を idea/_pipeline/ にブレスト化し直すか（メタ過剰の罠注意）
- N6. パイプラインを使わずに「とりあえず B2 + J3 + H4 + H5 束」だけ手で着手するか（パイプライン無しの bypass）

**個人的見立て**: N6（手作業 bypass で 1 束着手）と N2（パイロット Index 化）を並行するのが現実的。
パイプライン全実装は project_projection_vision より優先度低い。
パイプラインは「2 番目の束」を着手する時に必要になるので、その時に組めばよい。

---

## 未決（後で考える）

- Q1. Index の物理的な置き場所（idea/_index.json か別リポか）
- Q2. Score の Impact 重み（projection_vision 偏重 vs バランス）
- Q3. Triage の頻度（月次か週次か）
- Q4. Compile を AI が完全にやるか、人間が骨子を書いて AI が肉付けするか
- Q5. Dogfood の満足度ヒアリングを M3E 自身でやるか（meta_m3e）
- Q6. パイプラインを skill 化するか（/pipeline コマンド）
- Q7. このパイプラインを他のプロジェクト（個人ライフ管理等）にも展開するか

これらは「動かしてみてから決める」べき問い。
先に決めても外す。

---
project: AlgLibMove
date: 2026-04-16
topic: action plan — §3 sub-agent / §4 会話・意思決定 / §5 ツール・環境
source: backlog/dogfood_reflection_2026-04-16.md
status: draft (網羅優先・推敲前)
---

# 使い方

- 本 md は `dogfood_reflection_2026-04-16.md` の §3, §4, §5 の各 sub-item を actionable に分解したもの。
- 各項目は 6 ブロック: (1) 問題再定義 / (2) 実行手順 / (3) 判断点 / (4) 議論の場 / (5) コスト×blocking / (6) 前提。
- 着手順は **blocking → S/M → L** を優先。同 blocking 度内では `前提` の少ないものから。
- 「判断が必要な点」が空の項目は akaghef 決裁待ち不要 → sub-agent or Claude に即委譲可。
- 「議論の場」欄は記入先を一意にする。複数該当時は primary を最初に。
- §3 系は最終的に `~/.claude/skills/m3e-map/` 及び PJ 内 `NODE_FORMAT.md` / prompt テンプレに結晶化される想定。
- §4 系は `plan.md` 書き換え diff と port_log 分類軸の確定が終点。
- §5 系は `.gitignore` / commit 規約 md / `.claude/settings.json` の具体 diff 案で終点。
- 完了時は各項目末尾に `DONE: <date> <commit|md ref>` を付記。

---

# §3. sub-agent 運用

## §3.1 format 規範がプロンプトに無い

1. **問題再定義**: sub-agent がノードを name だけで作り、description/source を埋めない。
2. **実行手順**:
   - 既存 `m3e-map` skill SKILL.md を読む
   - PJ 直下に `NODE_FORMAT.md` を新規作成（section: common fields / per-type template / bad examples / good examples）
   - common 必須: `name`, `description (1-3 lines)`, `source (file:line or URL or oral)`, `layer (meta|implementation|domain)`, `status (placeholder|confirmed|contested|frozen)`
   - type 別テンプレを 6 種書く: concept / method / decision / port_log / open_problem / progress
   - bad/good の対比を各テンプレ 1 ペア書く（今夜の facet 1 `plus` ラベル問題を bad 例に）
   - `m3e-map` skill SKILL.md に `NODE_FORMAT.md` への reference を追記
   - skill 内 prompt テンプレに `Before POST, validate: name && description.length >= 20 && source` の gate を追記
   - テスト: sub-agent に 1 ノード作らせ、format violation が検出されるか確認
3. **判断点**: `description` 最低文字数の具体値 (20? 40?) / `source` が oral の場合の format (例 `oral:akaghef@2026-04-16` か) — akaghef decide
4. **議論の場**: backlog 新 md `node_format_spec.md` → 確定後 `NODE_FORMAT.md` と skill に反映
5. **コスト**: M × blocking（他の §3 項目の前提になる）
6. **前提**: なし

## §3.2 粒度規範がプロンプトに無い

1. **問題再定義**: method の内部構造（local variable / helper / branch）をどこまでノード化するか未定義で、sub-agent ごとに揺れる。
2. **実行手順**:
   - `NODE_FORMAT.md` に §粒度規範 section を追加
   - 粒度レベル L1-L4 を定義（L1=概念、L2=method/function、L3=branch/loop block、L4=line-level）
   - facet ごとに default level を宣言（facet 1 method=L2 / facet 3 call_flow=L3 / facet 7 dataflow=L3）
   - 「helper は親 method に description 内で言及、ノード化しない」等の具体 rule を 5-7 条書く
   - 例示: MATLAB `VectAlg.plus` の method node 1 つ + description に sub-case 3 パターンを列挙、の形
   - skill prompt に `subtree root の granularity_level を読め、逸脱するな` を追加
3. **判断点**: L3/L4 を使い分ける facet の特定（3 と 7 だけで十分か、10 verify も入るか）
4. **議論の場**: `node_format_spec.md` （§3.1 と同 md）
5. **コスト**: S × 独立
6. **前提**: §3.1

## §3.3 axis 規範がプロンプトに無い

1. **問題再定義**: depth=時間 / breadth=並列の規約が sub-agent に伝わらず、facet 3/7/12 で時系列が depth と breadth に散る。
2. **実行手順**:
   - `NODE_FORMAT.md` に §axis section を追加
   - `axis: temporal | taxonomic | dependency` 属性を subtree root で宣言必須化
   - temporal の規範: depth=時間進行、breadth=並列/分岐枝
   - taxonomic の規範: depth=specialization、breadth=sibling classification
   - dependency の規範: depth=downstream、breadth=independent peers
   - 分岐点ノード pattern を 1 例 (例: `if x>0` ノード → 子 2 つで `then`/`else` を breadth)
   - 既存 facet 3/7/12 の root に `axis` attribute を backfill するタスクを §7.5 と同期
   - skill prompt に `axis 未宣言の subtree に書き込まない` rule 追加
3. **判断点**: facet 12 progress の axis (temporal でいいか、それとも dependency 混在か)
4. **議論の場**: `node_format_spec.md` + map (facet 3/7/12 root で axis 属性確定)
5. **コスト**: S × 独立（§3.1 と並行で書ける）
6. **前提**: §3.1

## §3.4 並列 sub-agent 間の link 衝突

1. **問題再定義**: 同一 facet 内で並列書き込み → POST race で重複ノード。
2. **実行手順**:
   - 現 manager の serial/parallel 判定ロジックを M3E 本体 viewer.ts で確認（どこで分岐しているか特定）
   - subtree-level の advisory lock 仕様を設計（root node に `locked_by: agent_id, until: timestamp`）
   - agent POST 前に `GET node?id=root` → `locked_by` 確認 → 自 agent でなければ wait/skip
   - 楽観的ロック代替案: POST に `if-match: parent_updated_at` header、mismatch で 409 返却
   - どちらか選択し M3E 本体 issue として tracker に提出
   - 短期の workaround: canvas-protocol skill で「同 facet 並列禁止」を明記、manager が enforce
3. **判断点**: 悲観 lock vs 楽観 lock の選択 — akaghef + codex review
4. **議論の場**: M3E 本体 feature tracker (issue) + codex review (設計レビュー) / 短期規約は canvas-protocol skill
5. **コスト**: M × blocking（他 agent 並列を止めている要因）
6. **前提**: なし（短期 workaround のみ）／本対応は §3.6 と設計合わせ

## §3.5 partial output 活用なし

1. **問題再定義**: 中断/失敗 agent の途中成果（追加済ノード・下書き）が拾われず捨てられる。
2. **実行手順**:
   - agent 実行中の書き込みを `draft: true` 属性付きで POST する規約を新設
   - 完了時に `draft=false` に一括更新 (commit 的)
   - 中断時は `draft=true` のまま残る → 次回 agent または人間が拾える
   - viewer に `draft` ノードのフィルタ表示 UI 要求（M3E 本体）
   - skill prompt に `開始時に draft 宣言、完了時に finalize、異常時は draft のまま exit` を追加
   - partial recovery ツール: `m3e recover --agent=<id>` で draft を list / promote / discard
3. **判断点**: draft の TTL (24h? session 境界?) / 人間介入 UI の優先度
4. **議論の場**: M3E 本体 feature tracker + `node_format_spec.md` 内 §draft
5. **コスト**: M × 独立
6. **前提**: §3.1 (`status` 属性と重複しないよう整理)

## §3.6 agent の self-report 未要求

1. **問題再定義**: 実行後の追加ノード数・link 数を agent が自己報告せず、manager が GET で後追い確認している。
2. **実行手順**:
   - agent 完了時 output format を固定化（YAML blob: `added_nodes: N, added_links: M, updated: K, facets_touched: [...], open_questions: [...]`）
   - `m3e-map` skill に self-report テンプレ追加
   - agent prompt 末尾に `最後の assistant message は report blob で終えること` を mandatory
   - manager 側でこの blob を parse → timeline と progress facet に自動反映（§5.1 と合流）
   - self-report 欠落時は manager が failure として扱う (warning)
3. **判断点**: 報告フィールドの最小セット (上記 5 項目で足りるか、duration_ms や tool_calls も要るか)
4. **議論の場**: `node_format_spec.md` §self-report + m3e-map skill
5. **コスト**: S × 独立
6. **前提**: §3.1

---

# §4. 会話・意思決定

## §4.1 A→B→C→D 仮説が D-first で崩壊

1. **問題再定義**: plan.md の直列仮説が今夜の D-first one-shot で反証されたのに未更新、次読者を誤導する。
2. **実行手順**:
   - `plan.md` を開き、現行 Phase 説明 section を特定
   - 新 section `## Phase 順序の再定義 (2026-04-16 update)` を挿入
   - 旧主張を quote block で保存（削除ではなく履歴化）
   - 新主張を 4 条書く:
     (a) well-documented 領域では D-first 可
     (b) A は理解の前に記録として機能する場合あり
     (c) 世界モデルは implementation 成功後に harvest されうる
     (d) Phase は gate ではなく lens
   - 「Phase 移行条件」テーブルを更新（各 phase の入口・出口条件を再定義）
   - appendix に dogfood_reflection へのリンク追加
   - commit: `docs(plan): update phase hypothesis after D-first evidence`
3. **判断点**: 「A=記録 vs A=理解」を 2 モード併存と明記するか、理解モードを deprecate するか
4. **議論の場**: plan.md 直接改訂 + live 会話（akaghef 決定）
5. **コスト**: S × blocking（次セッションの読者誤導リスク）
6. **前提**: §4.2 と同期改訂（主成果物定義が連動）

## §4.2 世界モデル=主成果物の前提も再考

1. **問題再定義**: 「世界モデル=主成果物」を無条件前提にしていたが、本 PJ 短期 value は Julia コードで、世界モデルは再利用前提でのみ主成果物。
2. **実行手順**:
   - plan.md の「主成果物」section を特定
   - 「primary deliverable」を条件分岐で再記述: `if reuse_intent (paper / teaching / port) then world_model else code`
   - 本 PJ の stance を明記: `short-term primary = Julia code; long-term primary = world_model harvested post-implementation`
   - harvest プロセスを 1 段落で定義（implementation green → facet 5 に backfill → concept link 張り）
   - §7.4 の宿題と整合
   - commit: §4.1 と同 commit に含めて良い
3. **判断点**: 「harvest」の発動条件（green 時点? codex review 通過後? phase 終端?）
4. **議論の場**: plan.md + live 会話
5. **コスト**: S × 独立
6. **前提**: §4.1

## §4.3 dogfood 報告自体が非構造

1. **問題再定義**: 気付きを port_log に入れる際の分類軸が無く、全部 `scope_pain` に倒れる。
2. **実行手順**:
   - 分類軸 3 tier を確定: `layer: meta | implementation | domain` (§2.9 と合流)
   - 各 layer に sub-category を 3-4 個設定
     - meta: M3E_feature_request / process_rule / tool_friction / discussion_capture
     - implementation: design_decision / scope_pain / rejected_alt / test_gap
     - domain: math_fact / convention / open_question / reference
   - port_log テンプレをこの分類付きで再設計（skill prompt に埋め込む）
   - 本 dogfood md §6 (M3E 機能要求) を meta/M3E_feature_request で port_log に 21 件投入
   - 投入時 1 entry 1 ノード、本 md を `log_ref` として参照
   - §2.4 旧 6 カテゴリとの mapping 表を残す（移行期の互換）
3. **判断点**: sub-category の粒度（12 個で過多か、8 個に絞るか）／旧 `scope_pain` 等を deprecate するタイミング
4. **議論の場**: backlog 新 md `port_log_taxonomy.md` → 確定後 skill 反映 → map backfill
5. **コスト**: M × 独立
6. **前提**: §3.1 (`layer` 属性の共通化)

---

# §5. ツール・環境

## §5.1 timeline 手書き消耗

1. **問題再定義**: agent 実行ログから timeline を手書きで約 1h 要している、自動化余地が大きい。
2. **実行手順**:
   - agent self-report blob (§3.6) に `start_at`, `end_at`, `duration_ms` を必須化
   - manager wrapper script `scripts/timeline/append.js`（または .py）を新規追加：self-report を食わせ `julia/.../timeline_YYYY-MM-DD.md` に append
   - timeline md のフォーマット規約を 1 行化: `HH:MM [agent_id] +Nnodes +Mlinks summary`
   - MEMORY.md の `feedback_time_tracking.md` 規約と整合させる
   - hook として settings.json に登録（agent stop hook で append 実行）— update-config skill 必要
   - 初回は半自動（manager が手動起動）、慣れたら full auto
3. **判断点**: timeline の粒度（agent 単位 vs step 単位）／hook のトリガータイミング（SubagentStop / Stop）
4. **議論の場**: backlog 新 md `timeline_automation.md` + update-config skill（settings.json hook 設定）
5. **コスト**: M × 独立
6. **前提**: §3.6 (self-report blob format)

## §5.2 compaction 耐性ゼロ

1. **問題再定義**: 1 回の compaction で pre-phase の詳細時刻・思考推移が復元不能に失われる。
2. **実行手順**:
   - session 終端に session_summary を必ず出力する hook を追加（settings.json の Stop hook）
   - summary フォーマット: `facets_touched`, `decisions_made`, `open_questions_opened/closed`, `map_snapshot_ref`, `timeline_ref`
   - map snapshot を phase 遷移時に auto commit（§5.5 の git 規約と合流）
   - compaction 直前に「圧縮前 dump」をファイル書き出しする pre-compact hook（対応していれば）
   - MEMORY.md に session_summary の置き場 (`backlog/session_summary_YYYY-MM-DD.md`) を明記
3. **判断点**: summary を map に node 化するか、txt のままか（§1.12 原則では txt 優勢）
4. **議論の場**: `timeline_automation.md` と同 md + update-config skill
5. **コスト**: S × 独立
6. **前提**: §5.1 （hook infra 共有）

## §5.3 rm 権限拒否の摩擦複数回

1. **問題再定義**: Bash `rm` が都度拒否され作業が中断する。
2. **実行手順**:
   - `.claude/settings.local.json` の permissions.allow に具体パターンを追加
   - 追加候補:
     - `Bash(rm:**/tmp/*)`
     - `Bash(rm:**/node_modules/**)`
     - `Bash(rm:**/*.bak)`
     - `Bash(rm -rf:julia/**/tmp/**)`
   - 危険な `rm -rf /` 等は deny に残す
   - `.claude/settings.json` には commit 可能な範囲のみ、個人設定は `settings.local.json`
   - update-config skill を使って diff を生成 → akaghef 承認 → apply
   - 以後 1 週間、拒否が発生したらそのパターンを逐次追加
3. **判断点**: allow するパターンのスコープ（per-PJ か global か）
4. **議論の場**: update-config skill（settings.local.json 直接）+ live 会話
5. **コスト**: S × blocking（摩擦が継続的に発生）
6. **前提**: なし

## §5.4 session_metrics / timeline / port_log / debt_register の境界曖昧

1. **問題再定義**: 4 媒体のどれに何を書くか曖昧で、重複 or 欠落が発生。
2. **実行手順**:
   - §1.12 の txt/map 原則を具体ファイルに当てはめる表を backlog 新 md `media_routing.md` に作成
   - 各媒体 1 行 description + 入れるもの 3 件 + 入れないもの 3 件を書く
     - timeline_*.md = 時系列ログ / event / duration
     - session_metrics = agent 統計 / token / cost
     - port_log (map) = 再利用される観察・決定
     - debt_register.md = 未解決の構造的負債
   - 相互リンク規約: map ノードに `log_ref: path:L<line>` / txt に `map_ref: node_id`
   - MEMORY.md に 1 行 summary reference を追記
   - 既存重複（§2.2 port_log 二重化）を resolution：top-level を残し scope 9 を alias 化 or 削除
3. **判断点**: top-level port_log vs scope 9 のどちらを canonical にするか
4. **議論の場**: `media_routing.md` + map (port_log canonical 決定) + live 会話
5. **コスト**: S × 独立
6. **前提**: §3.1 （layer タグ共通化）

## §5.5 GitHub 運用ルール未整備

1. **問題再定義**: branch 切ったが commit / PR / tag / merge 戦略未定、今夜の 190 green も uncommit で再起動ロストリスク。
2. **実行手順**:
   - backlog 新 md `git_conventions.md` を作成（PJ 直下）
   - commit message 規約: `<phase>: <scope> <what>` (例 `D-6: hopf add Taft algebra`)
   - phase 終端で tag: `alglibmove/phase-D6`, `alglibmove/phase-D7`
   - commit 単位: 「実装 1 まとまり + tests green」
   - 禁止: green 前の commit, `-A` での一括 add（§claudeMd 既存規約と整合）
   - dev-beta への merge 戦略: `julia/` subtree を extract して別リポ (short term: 保留、branch 分離のまま)
   - 即 actions:
     a. 今夜の 190 green を commit（`D-6: hopf/HD Julia impl 190/190 green`）
     b. `backlog/*.md` 新規 3 件 を add commit
     c. `julia/notebooks/` は ignore 判定
     d. tag `alglibmove/phase-D6-green`
   - `.gitignore` 追記候補: `julia/notebooks/*.ipynb_checkpoints`, `julia/**/tmp/`, `*.bak`
3. **判断点**: dev-beta merge 戦略（subtree / 別リポ / 恒久 branch）／notebook を track するか
4. **議論の場**: `git_conventions.md` + live 会話（merge 戦略は akaghef 決定）
5. **コスト**: S × blocking（ロストリスク継続）
6. **前提**: なし（即着手可）

## §5.6 ショートカット質問トリガーなし

1. **問題再定義**: マップノードから Claude に問う操作が 4 ステップで発想が途切れる。
2. **実行手順**:
   - M3E viewer.ts に hotkey `?` を bind（m3e-shortcuts skill で追加）
   - 定型問い menu を 5 項目定義: 説明 / 不足情報 / 親概念との関係 / 実装先 / 反例
   - 選択時に prompt template + ノード context (path, description, ancestors, links) を clipboard に copy（MVP）
   - 次 step: Claude API 呼び出しをマップから直接実行、回答を子ノード attach
   - subtree root に `question_templates` 属性で独自テンプレ定義可能に
   - MVP は clipboard + paste、full 版は API 連携として別 issue
   - M3E 本体 feature tracker に 2 段階 issue を提出
3. **判断点**: API 直連 vs clipboard 経由 MVP の優先度 / hotkey の衝突確認 (`?` が使用中か)
4. **議論の場**: M3E 本体 feature tracker（2 issue）+ m3e-shortcuts skill（MVP 実装）
5. **コスト**: L × 独立（full 版）／S × 独立（MVP）
6. **前提**: なし

---

# 網羅チェック

- §3: 3.1 / 3.2 / 3.3 / 3.4 / 3.5 / 3.6 全 6 項目 done
- §4: 4.1 / 4.2 / 4.3 全 3 項目 done
- §5: 5.1 / 5.2 / 5.3 / 5.4 / 5.5 / 5.6 全 6 項目 done

合計 15 sub-item、全て actionable 化済。

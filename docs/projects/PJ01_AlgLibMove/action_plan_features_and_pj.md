---
project: AlgLibMove
date: 2026-04-16
topic: dogfood_reflection §6/§7 を行動分解したアクションプラン
status: draft (網羅優先・未推敲)
source: backlog/dogfood_reflection_2026-04-16.md §6, §7
---

# 使い方 (10 行)

1. 本 md は §6 (M3E 本体機能要求 21 項目) と §7 (PJ 宿題 7.1〜7.6) を独立に実行可能な単位に分解したもの。
2. 各項目は「問題再定義 / 実行手順 / 判断点 / 議論場所 / コスト×blocking / 前提 / 触る module (§6 のみ)」の 7 フィールド。
3. §6 は dev-beta の `beta/src/` への feat branch を前提。branch 名は各項目末尾に記載。
4. §7 は julia/ と docs/、map への実作業。7.1 → 7.5 (alias バグ検証) は今夜着手、7.6 (plan.md) は明日以降。
5. cost: S ≤半日 / M ≤3 日 / L ≥1 週。blocking = 他タスクを止めるもの、独立 = 単発で着手可。
6. 「議論場所」が `map` のものは M3E マップ内のノード化、`backlog/新 md` は本 backlog/ 直下、`live 会話` は akaghef に口頭確認、`codex review` は codex:rescue 系統。
7. §6 の「触る module」は 10-20 分 scout の見当値で、正確性より範囲確認用。
8. 実装順の推奨: §7.5 (alias バグ) → §7.1 (commit) → §7.2 MATLAB → §7.4 backfill → §7.6 plan.md → §6.1 系 → §6.2 系。
9. 全項目を raw にダンプしているため、優先度フィルタ (§6.1 最優先 / §6.2 高優先 / §6.3 中優先 / §6.4 snapshot / §6.5 運用) は dogfood_reflection §6.1〜§6.5 を参照。
10. 本 md は一人 sprint planning 入力。再編集時は map に抽出してから推敲する (§1.12 原則)。

---

# §6 M3E 本体機能要求 (21 項目)

## §6-1. alias バグ検証 (最優先)

- **問題**: alias 編集/削除/逆引きの挙動が不明で、マップ整合が崩壊しているリスク。
- **手順**:
  1. 再現 scenario を列挙 (canonical 編集 → alias 反映? / alias 編集 → canonical? / canonical 削除後 alias の挙動 / alias 先リンクの target 解決).
  2. 最小 reproduction ツリーを作り fixture 化.
  3. `beta/src/shared/types.ts` で alias ノードの schema 確認 (targetNodeId 等).
  4. viewer 側 (`beta/src/browser/viewer.ts`) の alias 描画・クリック挙動を trace.
  5. node 側 (`md_reader.ts` / `md_writer.ts` / `vault_importer.ts`) の alias 解決を grep.
  6. バグ特定後、修正 PR 起票.
  7. regression 用 unit test を `beta/tests/` に追加.
  8. memory の `m3e_alias_invariants.md` と照合、invariants 違反を列挙.
- **判断点**: alias 編集 UX (原本委譲 or 拒否)、削除 guard (cascade or block)、逆引き UI (sidebar or modal).
- **議論場所**: map (alias SSOT 設計) + backlog/新 md (検証レポート) + live 会話.
- **コスト/blocking**: S × blocking (全ての alias 運用を止める).
- **前提**: §7.5 とセット.
- **触る module**: `beta/src/shared/types.ts`, `beta/src/browser/viewer.ts`, `beta/src/node/md_reader.ts`, `md_writer.ts`. branch: `feat/alias-ssot-fix`.

## §6-2. 視覚階層 / 装飾 (importance / status / recency / completion)

- **問題**: 全ノード同じ見た目で重要度・状態・鮮度が識別不能.
- **手順**:
  1. 属性 schema 追加 (`importance: num`, `status: enum`, `updated_at`, `completion: pct`).
  2. 自動計算 rule (link 流入数 / 更新時刻 / 必須属性充足) を node 層で実装.
  3. viewer CSS tokens (color / weight / size / border) を定義.
  4. 手動タグ override UI (右クリック or hotkey).
  5. `hot path` / `cold path` は focus node 中心で BFS 距離計算.
  6. API: `GET /node/:id/decorations`.
  7. legend UI 追加.
  8. tests: import/export で decoration が round-trip するか.
- **判断点**: importance の自動計算 formula、status enum 値セット (placeholder/confirmed/contested/frozen で十分か).
- **議論場所**: map + live 会話 (色選定).
- **コスト/blocking**: M × 独立.
- **前提**: §6-1 完了後 (alias 絡みで style 計算が崩れない保証要).
- **触る module**: `shared/types.ts`, `browser/viewer.ts`, `browser/viewer.tuning.ts`. branch: `feat/visual-hierarchy`.

## §6-3. viewer-context 依存の collapse (akaghef default view)

- **問題**: static default collapse では俯瞰死ぬ or 過負荷. viewer × ノード × mode の関数にする.
- **手順**:
  1. viewer profile schema (`known_topics: string[]`, `current_focus: nodeId`).
  2. ノード側 `collapse_if` rule (DSL or predicate function).
  3. view mode enum (`teaching/research/implementation/review/overview`).
  4. mode switch UI (toolbar dropdown + hotkey).
  5. akaghef specific default (dogfood §1.11 表を config 化).
  6. 永続化 (profile は `~/.m3e/profile.json` or vault).
  7. ノード毎の manual override 記録.
  8. test: profile 切替で visible ノード集合が期待通り.
- **判断点**: DSL の表現力 (JSON rule vs JS expr), profile の portability.
- **議論場所**: map + backlog/新 md (DSL 仕様).
- **コスト/blocking**: L × 独立.
- **前提**: §6-2 の status 属性が出揃うと rule 記述が楽.
- **触る module**: `shared/types.ts`, `browser/viewer.ts`, new `shared/view_mode.ts`, new `node/profile_store.ts`. branch: `feat/viewer-context-collapse`.

## §6-4. グラフ視覚化 (mermaid / swim lane / sequence / DAG)

- **問題**: facet 3/4/7 が本質的グラフなのに tree+link では見えない.
- **手順**:
  1. subtree root に `view_type: tree|flow|sequence|matrix|swimlane` 属性.
  2. link subset → mermaid 文字列 generator (`shared/mermaid_export.ts`).
  3. viewer にパネル追加 (markdown_renderer で mermaid を render).
  4. sequence: `calls` link を actor×time 軸に投影.
  5. swim lane: `actor` 属性 + temporal axis で割付.
  6. DAG: `depends_on` から topological layout.
  7. export ボタン (クリップボード or png).
  8. tests: 既知 subtree で stable mermaid 出力.
- **判断点**: layout engine (mermaid native / d3 / 自作), 編集は tree のみに限定するか graph 上編集を許すか.
- **議論場所**: map + codex review (layout 選定).
- **コスト/blocking**: L × 独立.
- **前提**: `markdown_renderer.ts` が既に mermaid 対応か確認.
- **触る module**: `browser/markdown_renderer.ts`, `browser/viewer.ts`, new `shared/graph_projection.ts`. branch: `feat/graph-views`.

## §6-5. table-node / projection

- **問題**: 同形 sibling を比較不能 (18 ノード分散).
- **手順**:
  1. subtree root に `schema: [{field, type}]` 宣言.
  2. 子ノード attribute を schema に従わせる validation.
  3. viewer に table view mode 追加 (sibling を row, schema field を column).
  4. inline 編集 (cell クリック → attribute 更新).
  5. 不足 field は placeholder セル.
  6. sort / filter UI.
  7. export: markdown table / csv.
  8. tests: schema 変更で既存子が migrate される (非破壊).
- **判断点**: schema 強制度 (strict/lenient), 多型 sibling の扱い.
- **議論場所**: map + backlog/新 md (schema DSL).
- **コスト/blocking**: M × 独立.
- **前提**: §6-2 の属性 schema 強化と足並み.
- **触る module**: `shared/types.ts`, `browser/viewer.ts`, new `browser/table_view.ts`. branch: `feat/table-node`.

## §6-6. progress dashboard (ROOT 集計ビュー)

- **問題**: facet 12 progress のデータはあるが view がない.
- **手順**:
  1. aggregator (`node/progress_agg.ts`): phase meter / facet health / MSNF badge / blocker count / burn-down.
  2. ROOT ノードに `agg_widget: [...]` で表示制御.
  3. viewer でダッシュボードパネル.
  4. stale 判定 (最終更新 > N 日).
  5. open_problems / debt_register 連携 (path 指定で count).
  6. sparkline で burn-down.
  7. 自動更新 (watch mode).
  8. tests: fixture で期待値計算.
- **判断点**: dashboard 位置 (ROOT ノード or 別 panel), refresh interval.
- **議論場所**: map + live 会話.
- **コスト/blocking**: M × 独立.
- **前提**: §6-2 の status 属性.
- **触る module**: new `node/progress_agg.ts`, `browser/viewer.ts`, `shared/types.ts`. branch: `feat/progress-dashboard`.

## §6-7. shortcut query trigger (ノード → Claude 1 ステップ)

- **問題**: ノード質問が 4 step で発想断絶.
- **手順**:
  1. hotkey `?` binding (m3e-shortcuts skill 参照).
  2. 質問テンプレ menu (`説明/不足情報/親概念関係/実装先`).
  3. context 組み立て (ノード path + 親子 + link target 要約).
  4. Claude 呼び出し (ai_infra / ai_subagent 経由).
  5. 回答を子ノードに attach or popup.
  6. subtree root で custom template 登録.
  7. 履歴保存.
  8. tests: mock LLM で round-trip.
- **判断点**: LLM 出力をノード化するか popup に留めるか、cost 制御.
- **議論場所**: map + live 会話.
- **コスト/blocking**: M × 独立.
- **前提**: `ai_infra.ts` / `ai_subagent.ts` の API 安定.
- **触る module**: `node/ai_subagent.ts`, `browser/viewer.ts`, `node/ai_infra.ts`. branch: `feat/node-query-shortcut`.

## §6-8. alias SSOT 強化 (canonical flag / 委譲 / guard / 逆引き)

- **問題**: alias 運用の不透明性を §6-1 bug fix 以上に設計レベルで再定義.
- **手順**:
  1. canonical flag を schema レベルで明示.
  2. 編集時委譲 rule (alias 編集 → canonical reflect, canonical → 全 alias propagate).
  3. 削除 guard (canonical 削除は alias 全 reassign または拒否).
  4. 逆引き API (`GET /node/:id/aliases`).
  5. UI: canonical バッジ / alias 一覧 sidebar.
  6. audit log 拡張 (alias op 全記録).
  7. migration (既存 alias に canonical flag backfill).
  8. tests: memory の invariants 遵守.
- **判断点**: alias 同士の循環防止 algorithm, propagation の batch / immediate.
- **議論場所**: map + codex review.
- **コスト/blocking**: M × blocking (§6-1 の発展).
- **前提**: §6-1 完了.
- **触る module**: `shared/types.ts`, `browser/viewer.ts`, `node/audit_log.ts`, `node/md_writer.ts`. branch: `feat/alias-ssot-v2`.

## §6-9. class / instance 分離

- **問題**: concept:Hopf と instance:CGA(3) が同種.
- **手順**:
  1. ノード種別 `kind: class | instance | individual` 追加.
  2. `instance_of` link の domain/range 強制.
  3. UI: kind 別アイコン.
  4. instance から class 属性継承 rule.
  5. class 定義の axiom 継承.
  6. migration (既存ノードに kind backfill).
  7. query: `list instances of X`.
  8. tests: fixture.
- **判断点**: `kind` を enum か自由型か、混成ノード (meta-class) の扱い.
- **議論場所**: map + backlog/新 md.
- **コスト/blocking**: M × 独立.
- **前提**: §6-13 の link 定義ノード化と並走推奨.
- **触る module**: `shared/types.ts`, `browser/viewer.ts`, new `shared/ontology.ts`. branch: `feat/class-instance`.

## §6-10. inverse link 自動生成

- **問題**: inverse link を手動で張っている.
- **手順**:
  1. link 定義に `inverse: string` 属性.
  2. node 層で link 追加時に inverse 自動 insert.
  3. 削除時も対称.
  4. 既存 link の backfill migration.
  5. 整合性 checker (一方向 only を warn).
  6. UI: inverse 表示トグル (表裏).
  7. tests: round-trip.
  8. 旧 manual inverse link を dedup.
- **判断点**: inverse 未定義 link の扱い (警告 or 自由).
- **議論場所**: map (link 定義 table).
- **コスト/blocking**: S × 独立.
- **前提**: §6-13.
- **触る module**: `shared/types.ts`, `node/md_writer.ts`, `node/md_reader.ts`. branch: `feat/inverse-link-auto`.

## §6-11. axiom / constraint ノード + 違反検出

- **問題**: 「全 Hopf 代数は antipode を持つ」の制約が静的.
- **手順**:
  1. ノード種別 `axiom` + 述語 DSL (`forall x: class=Hopf => x.has(antipode)`).
  2. constraint checker (`node/constraint_check.ts`).
  3. 違反ノードにマーキング (§6-2 status=contested 連携).
  4. CLI / viewer パネルで違反 list.
  5. 手動 override (exception 属性).
  6. 軽い推論 (subClassOf 伝播).
  7. 周期 check + on-save check.
  8. tests: Hopf 公理例で動作確認.
- **判断点**: DSL 表現力、推論コストの上限.
- **議論場所**: map + codex review (DSL 設計).
- **コスト/blocking**: L × 独立.
- **前提**: §6-9 class/instance.
- **触る module**: new `node/constraint_check.ts`, `shared/ontology.ts`, `browser/viewer.ts`. branch: `feat/axiom-constraint`.

## §6-12. SPARQL 相当の query 言語

- **問題**: 「quasi-Hopf を継承し associator を持つ class」が問えない.
- **手順**:
  1. 小さい query DSL (pattern match on tree+link) 仕様.
  2. parser + executor (`node/query.ts`).
  3. viewer の query バー (hotkey `/`).
  4. 結果を仮想 facet として表示.
  5. 保存済み query (named view).
  6. export 可.
  7. 速度最適化 (index).
  8. tests.
- **判断点**: 完全独自 DSL vs SPARQL subset vs Datalog-ish.
- **議論場所**: map + backlog/新 md (DSL 仕様) + codex review.
- **コスト/blocking**: L × 独立.
- **前提**: §6-13 link 定義ノード.
- **触る module**: new `node/query.ts`, `browser/viewer.ts`, `shared/types.ts`. branch: `feat/ontology-query`.

## §6-13. link 種別の定義ノード化 (domain/range/inverse/transitive)

- **問題**: 15+ の link 種別が暗黙で濫用.
- **手順**:
  1. システム facet `LinkDefs` を固定位置に配置.
  2. 各 link 種別をノード化 (attr: domain, range, inverse, transitive, symmetric).
  3. バリデータ: link 作成時に定義に従う.
  4. 10 種以内に統廃合 (既存 audit).
  5. UI: link 作成時の auto-complete + 制約ヒント.
  6. migration.
  7. docs 自動生成.
  8. tests.
- **判断点**: 統廃合の 10 種をどう選ぶか (`realizes/calls/contains/inherits/instance_of/...`).
- **議論場所**: map (system facet) + live 会話 (統廃合判定).
- **コスト/blocking**: M × blocking (§6-10/§6-11/§6-12 の前提).
- **前提**: なし (最初にやる).
- **触る module**: `shared/types.ts`, `node/md_reader.ts`, `node/md_writer.ts`. branch: `feat/link-def-nodes`.

## §6-14. git-backed snapshot (auto commit on session/phase)

- **問題**: 時点復元不能.
- **手順**:
  1. vault を git repo 初期化 (未なら).
  2. session 開始/終了 hook で auto commit.
  3. phase marker 変化で auto commit + tag.
  4. commit message 規約 (`snapshot: <phase>/<session> <N nodes>`).
  5. settings.json hook 化 (update-config skill).
  6. ignored file 規約.
  7. conflict resolution.
  8. tests.
- **判断点**: commit 単位 (1 op? / 1 session?), repo 場所.
- **議論場所**: update-config skill + live 会話.
- **コスト/blocking**: S × 独立.
- **前提**: なし.
- **触る module**: `node/backup.ts`, new `node/git_snapshot.ts`, `node/vault_watch.ts`. branch: `feat/git-snapshot`.

## §6-15. named snapshot + diff + time scrub

- **問題**: snapshot 間比較・時間軸閲覧なし.
- **手順**:
  1. named snapshot API (tag).
  2. diff engine (node add/delete/modify).
  3. viewer の diff panel.
  4. time scrub UI (slider).
  5. past 時点 read-only view.
  6. revert 操作.
  7. tests.
  8. docs.
- **判断点**: diff 粒度 (ノード全体 / attribute 単位).
- **議論場所**: map + live 会話.
- **コスト/blocking**: M × 独立.
- **前提**: §6-14.
- **触る module**: new `node/snapshot_diff.ts`, `browser/viewer.ts`. branch: `feat/snapshot-diff-scrub`.

## §6-16. txt / map 役割分離の運用規約 + log_ref pointer

- **問題**: どの情報を txt/map に置くか曖昧.
- **手順**:
  1. dogfood §1.12 表を規範 md 化 (`docs/conventions/txt_map_separation.md`).
  2. ノード attribute `log_ref: path:line`.
  3. viewer でクリックして txt をハイライト表示.
  4. 逆は持たない (片方向規約を明記).
  5. skill (m3e-map / tomd) プロンプトに埋め込む.
  6. 既存ノードの backfill task を backlog へ.
  7. lint (log_ref の dead link 検出).
  8. tests.
- **判断点**: log_ref の vault 相対か absolute か.
- **議論場所**: docs + live 会話.
- **コスト/blocking**: S × 独立.
- **前提**: なし.
- **触る module**: `shared/types.ts`, `browser/viewer.ts`, skills 定義. branch: `feat/log-ref`.

## §6-17. auto-timeline from agent duration_ms

- **問題**: timeline 手書き 1h/回.
- **手順**:
  1. agent 完了 event に duration_ms 必須化.
  2. collector (`node/timeline_gen.ts`).
  3. skill / CLAUDE.md で step 毎 log 規約 (memory `feedback_time_tracking.md`).
  4. daily md 自動生成 (`timeline_YYYY-MM-DD.md`).
  5. manual 補足欄.
  6. 集計 stats.
  7. tests.
  8. docs.
- **判断点**: event source (hook / SDK), manual 追記 merge policy.
- **議論場所**: update-config + live 会話.
- **コスト/blocking**: S × 独立.
- **前提**: なし.
- **触る module**: new `node/timeline_gen.ts`, settings.json hooks. branch: `feat/auto-timeline`.

## §6-18. agent self-report contract

- **問題**: agent 完了時に追加ノード/link 数が報告されない.
- **手順**:
  1. skill 定義に self-report section 強制 (m3e-map skill).
  2. report format 固定 (`added: N nodes / M links`).
  3. manager 側で parse して progress facet に書き込み.
  4. 違反時の fail.
  5. fixture skill.
  6. template library と連携.
  7. tests.
  8. docs.
- **判断点**: report を map に反映する自動度.
- **議論場所**: skill 定義 + live 会話.
- **コスト/blocking**: S × 独立.
- **前提**: なし.
- **触る module**: skills (m3e-map), new `node/agent_report.ts`. branch: `feat/agent-self-report`.

## §6-19. m3e-map skill への format テンプレ埋め込み

- **問題**: sub-agent がラベルだけノードを作る.
- **手順**:
  1. ノード種別毎テンプレ (concept/method/decision/port_log).
  2. 必須 field 明示 (name/description/source).
  3. skill SKILL.md に embedded example.
  4. 違反時の warning.
  5. 既存ノード backfill task を backlog.
  6. 新規作成時 API で schema 検証.
  7. tests.
  8. docs.
- **判断点**: 強制度 (warn / block).
- **議論場所**: skills + live 会話.
- **コスト/blocking**: S × 独立.
- **前提**: なし.
- **触る module**: skills (m3e-map), `shared/types.ts`. branch: `feat/node-format-template`.

## §6-20. PJ ごとの NODE_FORMAT.md 規範

- **問題**: PJ 固有のノード粒度規範が口頭伝承.
- **手順**:
  1. `docs/projects/<pj>/NODE_FORMAT.md` を標準配置に.
  2. テンプレ (粒度/axis/必須 field/tag 語彙).
  3. AlgLibMove 版作成.
  4. skill が PJ 起動時に読み込む.
  5. map 側から link.
  6. review で参照.
  7. lint.
  8. docs.
- **判断点**: 規範 vs 推奨の強制度.
- **議論場所**: docs + live 会話.
- **コスト/blocking**: S × 独立.
- **前提**: §6-19.
- **触る module**: docs のみ (M3E 本体は skill loader 微調整). branch: `feat/pj-node-format`.

## §6-21. prompt template library (ingest / 抽出 / 規約記録 / port_log)

- **問題**: agent プロンプトが毎回 ad hoc.
- **手順**:
  1. `docs/prompt_library/` に 5-6 本.
  2. categories: ingest / concept extraction / convention record / port_log harvest / review request.
  3. skill から参照可能な形式.
  4. variable 穴 (`{{facet}}` 等).
  5. version 管理.
  6. 使用ログ収集.
  7. review / 改訂サイクル.
  8. docs.
- **判断点**: template 形式 (md + front matter? DSL?).
- **議論場所**: docs + live 会話.
- **コスト/blocking**: S × 独立.
- **前提**: §6-19.
- **触る module**: docs + skills. branch: `feat/prompt-library`.

---

# §7 AlgLibMove PJ 個別宿題

> 実行順: §7.5 (alias バグ, blocking) → §7.1 (commit) → §7.2 (MATLAB golden) → §7.3 (残 method) → §7.4 (世界モデル backfill) → §7.6 (plan.md).

## §7.1 今夜の Julia 実装の後始末

### 7.1-a 190 green state を commit

- **問題**: 今夜の成果が untracked、再起動ロストリスク.
- **手順**: 1) `git status` で untracked 確認 2) commit 規約決定 (§5.5 未決) — 最低限 `<phase>: <動詞> <対象>` 3) julia 変更のみ stage 4) backlog/ 新 md stage 5) commit 6) `prj/AlgLibMove` 確認 7) push (local 留めでも可) 8) progress facet 更新.
- **判断点**: backlog/ の reflection/review 系 md を同 commit に含めるか分割するか.
- **議論場所**: live 会話 + §5.5 規約 md.
- **コスト/blocking**: S × blocking (他作業の前に).
- **前提**: §5.5 commit 規約の仮決め.

### 7.1-b Codex review 取り込み

- **問題**: `backlog/codex_review_request_hopf_hd.md` と `design_integrity_review_hopf_hd.md` の未反映.
- **手順**: 1) 2 md 読む 2) 指摘を severity 分類 3) critical は即 fix 4) minor は debt_register へ 5) feedback 形式 (rule/why/how_to_apply) で map に記録 6) 該当 jl 修正 7) test 再実行 8) commit.
- **判断点**: critical/minor 境界.
- **議論場所**: codex review + map.
- **コスト/blocking**: M × 独立.
- **前提**: 7.1-a.

### 7.1-c 採用規約を facet 11 に記録

- **問題**: Kassel 流 / ω / HD 積公式が SSOT 化されていない.
- **手順**: 1) facet 11 ノード準備 2) 今夜の 7 規約を列挙 3) 各規約に rule/why/rejected_alternatives 4) 根拠 (MATLAB line / Kassel page) 5) link で該当実装へ 6) table-node (§6-5 完了後) で一覧 7) review.
- **判断点**: ω の具体値 (`exp(2πi/n)` vs 代数的) の記述深度.
- **議論場所**: map (facet 11).
- **コスト/blocking**: S × 独立.
- **前提**: なし.

### 7.1-d Hopf/HD 実装を facet 5 concept に realizes link

- **問題**: 実装と concept が結ばれていない.
- **手順**: 1) facet 5 の concept ノード棚卸 2) jl の struct/method に対応付け 3) `realizes` link 付与 4) 方向規約確認 5) inverse link (§6-10 未なら手動) 6) validate.
- **判断点**: realizes の方向 (impl→concept).
- **議論場所**: map.
- **コスト/blocking**: S × 独立.
- **前提**: §6-13 link 定義があると楽.

### 7.1-e @calcTE マクロを facet 7 dataflow に反映

- **問題**: マクロの展開先と data 流が未記録.
- **手順**: 1) マクロ src 再読 2) 展開例 (sweedler, taft) を記録 3) facet 7 に入力→変換→出力 4) @calcTE → generated function の link 5) edge case 付記.
- **判断点**: マクロ内部を何層まで展開するか.
- **議論場所**: map.
- **コスト/blocking**: S × 独立.
- **前提**: §6-4 grap view があると可視化が楽.

## §7.2 MATLAB golden との数値一致 gate

### 7.2-a MATLAB 実行環境整備 (Octave 代替含む)

- **問題**: golden を出す側の計算機環境未確立.
- **手順**: 1) MATLAB license 確認 2) なければ Octave で AkaghefAlgebra が動くか調査 3) 差異 (OOP / class file syntax) 吸収層 4) 最小 smoke (VectAlg コンストラクタ) 5) 再現手順を `docs/matlab_env.md` 6) CI 可能性検討.
- **判断点**: MATLAB 常用 vs Octave 代替、CI に乗せるか手動.
- **議論場所**: live 会話 + backlog/新 md.
- **コスト/blocking**: M × blocking (7.2 全体の前提).
- **前提**: なし.

### 7.2-b 構造定数 dump format 決定

- **手順**: 1) 候補列挙 (JSON/TOML/CSV/MAT) 2) Julia 側 read easiness 3) hash で drift 検出 4) versioning 5) decimal 桁数規約 6) prototype 1 件 7) schema 固定.
- **判断点**: 複素数 encoding, 疎行列表現.
- **議論場所**: map (decision).
- **コスト/blocking**: S × blocking.
- **前提**: 7.2-a.

### 7.2-c parity test framework `julia/test/parity/`

- **手順**: 1) dir 作成 2) load helper 3) per algebra test file 4) `compare(julia, golden; atol)` helper 5) runtests.jl に登録 6) CI 配線 7) failure report 8) docs.
- **判断点**: atol (0 or 1e-12), 欠損 golden の扱い.
- **議論場所**: live 会話.
- **コスト/blocking**: S × 独立.
- **前提**: 7.2-b.

### 7.2-d 3×5 = 15 セル golden 一致マトリクス

- **手順**: 1) MATLAB で 3 代数 × 5 構造マップ dump 2) Julia で同じ計算 3) セル比較 4) 不一致分析 5) matrix を map に記録 (§6-5 table 完了後が理想) 6) 完全一致を phase gate.
- **判断点**: 不一致時の方針 (MATLAB 正解 or Julia 正解).
- **議論場所**: map + codex review.
- **コスト/blocking**: L × blocking (phase gate).
- **前提**: 7.2-a/b/c.

## §7.3 残 method 実装

### 7.3-a Integrals (left/right/two-sided)

- **手順**: 1) MATLAB 実装読 2) Julia interface 設計 3) 実装 4) unit test 5) Sweedler/Taft で verify 6) HD は後 7) docs.
- **判断点**: 正規化慣習.
- **議論場所**: map + codex review.
- **コスト/blocking**: M × 独立.
- **前提**: 7.1 後始末完了.

### 7.3-b rep (行列表現)

- **手順**: 1) 表現の定義固定 2) basis 規約 3) 実装 4) test 5) HD との連携 6) docs.
- **判断点**: left/right rep 両方か.
- **議論場所**: map.
- **コスト/blocking**: M × 独立.
- **前提**: 7.3-a.

### 7.3-c act (action on H*)

- **手順**: 1) pairing 規約固定 (7.4-c 連動) 2) 実装 3) test 4) Kashaev embedding 前段 check 5) docs.
- **判断点**: dual pairing の選択.
- **議論場所**: map + codex.
- **コスト/blocking**: M × 独立.
- **前提**: 7.3-b, 7.4-c.

### 7.3-d canonical elements G, W, W⁻¹

- **手順**: 1) 定義確認 2) 実装 3) inverse 検算 test 4) HD で使う scenario 5) docs.
- **判断点**: 計算 strategy (symbolic vs numeric).
- **議論場所**: map.
- **コスト/blocking**: M × 独立.
- **前提**: 7.3-c.

## §7.4 世界モデルの backfill

### 7.4-a Julia 実装知見を facet 5 に戻す

- **手順**: 1) 実装中出た lemma/corollary を列挙 2) concept ノード化 3) 既存と重複排除 4) 参照 link 5) review.
- **判断点**: 新概念 vs 既存 refinement.
- **議論場所**: map.
- **コスト/blocking**: M × 独立.
- **前提**: 7.1.

### 7.4-b HD 積公式の選択差分を明示

- **問題**: `(f⊗h)(g⊗k) = f(h₁▶g)⊗h₂k` vs MATLAB VectHeisenbergDouble.setConst.
- **手順**: 1) 両公式を文字通り書き下す 2) 同値性 or 差分判定 3) 選択理由 4) rejected alt 記録 5) unit test で両方 verify (選ばなかった方は comment) 6) facet 11 に記録.
- **判断点**: 選択 (Kassel 流 で固定?).
- **議論場所**: map + codex review.
- **コスト/blocking**: S × blocking (7.3-c/d の前提).
- **前提**: 7.1-c.

### 7.4-c dual pairing の定義選択 concept 化

- **手順**: 1) dual basis / natural pairing 定義併記 2) 採用選択 + 理由 3) concept ノード化 4) impl へ link 5) test 6) docs.
- **判断点**: dual basis 採用か.
- **議論場所**: map + codex.
- **コスト/blocking**: S × blocking (7.3-c).
- **前提**: 7.1-c.

## §7.5 マップ健全性回復

### 7.5-a alias バグ検証 (最初にやる)

- §6-1 と同一作業だが PJ 側 scope. §6-1 手順参照.
- **コスト/blocking**: S × blocking (最優先).
- **前提**: なし.

### 7.5-b 既存 facet の depth 平坦化

- **手順**: 1) depth 4+ 箇所 audit 2) 中間ノードを tag 候補化 3) 平坦化 migration script 4) 手動 review 5) before/after snapshot (§6-14 あると楽) 6) 壊れた link 修復.
- **判断点**: どの facet から始めるか (facet 1 VectAlg から).
- **議論場所**: map + live 会話.
- **コスト/blocking**: M × 独立.
- **前提**: 7.5-a.

### 7.5-c 中間グルーピングノードを tag 属性に降格

- **手順**: 1) 中間ノード列挙 2) tag 語彙定義 3) 子ノード attribute に tag 移管 4) 中間ノード削除 5) viewer で tag filter 機能 (§6-5 連動可) 6) validate.
- **判断点**: tag 語彙は PJ 固有か共通か.
- **議論場所**: map.
- **コスト/blocking**: M × 独立.
- **前提**: 7.5-b.

### 7.5-d link 種別を 10 種以内に統廃合

- **手順**: 1) 現在 15+ を audit 2) 統合 mapping 3) script で置換 4) inverse 再計算 5) §6-13 link 定義ノード作成 6) validate 7) doc.
- **判断点**: 統合 mapping 表 (`uses_class`+`calls`+`calls_function` → ?).
- **議論場所**: map + live 会話 (統合判定).
- **コスト/blocking**: M × blocking (7.5-c と相互依存).
- **前提**: §6-13 と一緒に進める.

### 7.5-e audience / view mode 属性を backfill

- **手順**: 1) §6-3 DSL 決まってから 2) akaghef default 表 (§1.11) 適用 3) 既存ノードに collapse rule 4) verify 5) profile 保存.
- **判断点**: 後回し可.
- **議論場所**: map.
- **コスト/blocking**: S × 独立 (deferred until §6-3).
- **前提**: §6-3.

## §7.6 plan.md の更新

### 7.6-a A→B→C→D 仮説を D-first valid に更新

- **手順**: 1) 当該段落特定 2) 新仮説 draft 3) dogfood reflection §4.1 引用 4) appendix に dogfood 発見追加 5) live 会話で akaghef 確認 6) 更新 commit.
- **判断点**: 「D-first valid」の条件 (well-documented domain 限定か).
- **議論場所**: live 会話 + backlog/新 md.
- **コスト/blocking**: S × 独立.
- **前提**: dogfood reflection 完.

### 7.6-b 「世界モデル=主成果物」→「conditional on reuse intent」

- **手順**: 1) plan.md 該当段落特定 2) 新文言 draft 3) 条件明示 (reuse intent: 論文/教育/他言語移植) 4) 現 PJ 短期 value を Julia コードと明記 5) commit.
- **判断点**: reuse intent の判定主体.
- **議論場所**: live 会話.
- **コスト/blocking**: S × 独立.
- **前提**: 7.6-a.

### 7.6-c Phase 移行条件を現実に合わせる

- **手順**: 1) 現 phase 定義抽出 2) 実際の遷移観察 3) 条件緩和/厳密化 4) 明示的 gate (例: parity 15/15) 5) 確認.
- **判断点**: gate の厳密性.
- **議論場所**: live 会話.
- **コスト/blocking**: S × 独立.
- **前提**: 7.6-a/b.

### 7.6-d dogfood 発見を appendix に追記

- **手順**: 1) dogfood §0 テーマ抽出 2) appendix section 立て 3) §6/§7 へのリンク 4) 将来更新ルール 5) commit.
- **判断点**: 詳細レベル.
- **議論場所**: live 会話.
- **コスト/blocking**: S × 独立.
- **前提**: 7.6-a/b/c.

---

# 付録: 実行順クイックリファレンス

1. 今夜: §7.5-a (alias 検証 = §6-1) → §7.1-a (commit).
2. 明日午前: §7.1-b/c/d/e → §7.6 (plan.md) → §7.4-b/c (HD 積公式 / pairing).
3. 今週: §7.2-a/b/c/d (MATLAB golden) → §7.5-b/c/d (平坦化) → §6-13 (link 定義).
4. 今月: §6-2 / §6-6 / §6-14 (装飾 / dashboard / snapshot) は低コストで手を入れられる.
5. 中期: §6-3 / §6-4 / §6-11 / §6-12 (認知補助 + オントロジー層) は `feat/m3e-cognition-layer` 系列として束ねる.

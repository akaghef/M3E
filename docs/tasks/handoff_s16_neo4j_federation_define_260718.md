# Handoff: S16 連邦化 Strategy レビュー結論と Phase 0 define 指示

- 日付: 2026-07-18
- 起草: Claude Director（akaghef との define 対話の収束成果物）
- 対象: PR #74（`codex/neo4j-federated-strategy`、Strategy.md S16）および Phase 0 spec-init
- 宛先: Codex worker
- 関連: [../01_Vision/Strategy.md](../01_Vision/Strategy.md) S16 / [../../protocols/repository-canon-values.md](../../protocols/repository-canon-values.md) / [../03_Spec/Scope_and_Alias.md](../03_Spec/Scope_and_Alias.md) / [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md)

---

## 1. レビュー総評

S16 の中核命題「局所正本の連邦化＋再構築可能な materialized global graph＋write authority の owner routing」は M3E 思想（P1/P4/P6/P7、repository-canon-values）と整合し、採用に値する。ただし merge 前修正 6 点（MP2〜MP7）、最重要の見落としは **大域 graph 自体がアクセス制御の抜け穴になる問題**（MP3）と **UX 摩擦起点の dual-canon 退行**（IS-B）。

### AA〜AI 短答

- **AA（思想整合）**: 整合。最大の緊張は P1 個人オフラインファースト vs DB サーバー運用。破綻条件は「単一 viewer 面に複数 authority を mount した状態での日常編集」（undo・reparent の分散問題化）。
- **AB（Neo4j 正本領域）**: Neo4j を正本にすべき entity/assertion は存在しない。境界は正しい。唯一の危険は proposal 領域の正本欠落（MP2）。
- **AC（Rapid/Deep 分離）**: 分離は健全。壊れるのは ①occurrence 編集による binding の意味 drift ②entity merge（redirect/tombstone 方式必須、現状言及ゼロ）③binding 所有の二重化リスク。
- **AD（Scope/Authority）**: 概念矛盾なし。ただし「cross-authority reparent Command は拒否して transfer workflow へ変換」の不変条件が未明文。最小 transfer 契約は §3 Follow-up 参照。
- **AE（多主体モデル）**: 骨格は良い。不足: Command の base-revision 必須化（CAS）、bot echo 抑止、registry 正本、「Obsidian ネイティブ編集は Command 境界を通らず indexing で到着する」事実の明示。
- **AF（見落とし）**: graph 権限（MP3）、registry 単一障害点、孤児 source 消失時の archive 導線（P6 衝突）、undo 意味論、P1 運用摩擦。
- **AG（分割昇格）**: Principle 1 件昇格候補（Single Source of Authority per durable concern）、V4 文言進化（新 Vision 不要）、Glossary 一式、Data_Model DB 選定節改訂、ADR 1 本、S16 本体の 04_Architecture 文書化（減量）。
- **AH（PR triage）**: §2〜§4 参照。
- **AI（代替）**: 軽度の混同が見出しにあったが blocker から降格（DC2）。graph substrate への実要求は「typed property graph・traversal・rebuildable・ローカル動作」であり、Kùzu（組込み）/ DuckDB+SQL/PGQ / Apache AGE も adapter 候補。Phase 2 shadow materialization を adapter 比較の場とする。

## 2. Must patch before merge（PR #74）

| ID | 修正 | 対象節 |
|---|---|---|
| MP2 | proposal/pending assertion の正本を明示（M3E-local source / journal。Neo4j は materialize のみ）。Neo4j 消失＝判断待ちキュー消失は P6 違反 | S16.3 / S16.7 |
| MP3 | risk 表に「graph-level exposure」行を追加: private source を index した内容が Neo4j 上で source 権限と無関係に読める。fine-grained access control は Enterprise 専用。Phase 2 gate に「materialization は source classification でフィルタ」を追加 | S16.16 / S16.15 |
| MP4 | 既存正典の supersession 明示: Data_Model.md「データベース選定方針」（PostgreSQL 第一候補）、Storage_And_Collab_Overview.md の正本表を「S16 が supersede 予定・ADR で正式化」と明記。正典文書群内の dual-canon を防ぐ | 新設節 |
| MP5 | Rapid Node Occurrence / Deep Entity 分離を S16 本文へ小節追加（3〜5 行、詳細仕様は Phase 0 へ委譲）。**akaghef 採用確定済み（DC6）** | 新設小節 |
| MP6 | anchor use case 節を S16 冒頭へ追加（DC1: UC-A、下記 §5）。Phase 2 後半（Neo4j shadow）の開始 gate =「UC-B の具体クエリが実需として 3 つ以上書ける」 | S16 冒頭 / S16.12 |
| MP7 | risk 表に **IS-B: 摩擦起点の dual-canon 退行** を追加: routed write の UX 摩擦が高いと、ユーザー/AI が正本の脇に私的複製・メモを生やし、制度でなく摩擦の沈殿として dual-canon が再発する。対策 = micro-edit lane（提案キュー→Director が日次 batch PR 化）＋運用メトリクス「routed write が 1 日 3 回超なら境界の誤り」 | S16.16 |

（旧 MP1「見出しの Neo4j 除去」は取り下げ。S16.17「Neo4j primary 化を成功条件にしない」の堅持で足りる — DC2）

## 3. Follow-up ADR/spec（merge 後）

- **ADR: Neo4j 採用＋正本再割当**（MP4 の履行本体。Data_Model / Storage_And_Collab_Overview 改訂）
- **ownership transfer 最小契約**: ①stable ID 不変 ②二相 commit（source `pending-transfer` → dest 追加 → source tombstone/redirect）③承認は各 authority の revision 系 ④全中間状態が表現・回復可能 ⑤journal に両 commit 連結。＋ cross-authority reparent の Command 層拒否、mount point 所有（authority root ノード自体は親 authority、中身は子 — git submodule 同型）
- **Deep entity merge/split**: redirect/sameAs tombstone 方式（Wikidata 型）。束縛が多 source 散在のため書き換え方式は不成立
- **binding 所有規則 ＋ lazy entity 生成**（全 Rapid node に Deep entity を強制しない）
- **Command base-revision（CAS）＋ bot echo 抑止**（provenance 同値 write 棄却）
- **source registry の正本・backup・Mac/Win 同期**（registry は再導出不能、単一意味障害点）
- **孤児 source の archive/adoption policy**（source 恒久消失時に最終 materialization を M3E 所有 archive へ引き取る）
- **Undo/Redo 意味論**（owner routing 下の未 merge 提案に対する undo。S16.14「history の解釈」の具体化）
- **Glossary 登録**: authority root、canonical owner、source 分類、referential 状態語彙、occurrence/entity、＋§7 の RAG 軸
- **Principle 昇格提案**: Single Source of Authority per durable concern（akaghef 確定待ち）
- **Neo4j edition/deployment ADR**: P1 適合評価。組込み代替（Kùzu 等）を adapter 比較に含める
- **Strategy 減量**: S16 本文（約 500 行）を 04_Architecture へ移し、S16 は約 30 行の方針＋リンクへ縮約

## 4. Rejected assumptions（棄却確認）

- 「SSOT は不可能」→ 正しくは per-entity/assertion の Single Source of Authority
- 「安全性＝中央集約」→ 安全性 = write authority 制限＋履歴＋検証＋rollback
- 「常に最新の単一大域正本」→ 強整合放棄、revision 付き snapshot 合成（S16.6 のとおり）
- 「.m3e/ に repo 別 SQLite」「Neo4j binary の Git 管理」「scope＝storage/authority 境界」「Neo4j primary 昇格＝成功条件」「Rapid 本文の Deep 複製」→ すべて棄却妥当

## 5. 確定判断（DC）

| ID | 判断 |
|---|---|
| DC1 | anchor use case = **UC-A**「repo-local semantic source を agent/CI が file read で使える」。検証場 = M3E 開発 dogfooding（MDD/V5）。UC-B（大域横断探索）はまだ実需がなく、Neo4j はその実需発生まで判断後置 |
| DC2 | 見出しの Neo4j 明記は許容（S13 の過剰適用を避ける）。撤退条件 S16.18-10 の維持が条件 |
| DC3 | merge 前必須修正 = §2 の MP2〜MP7 |
| DC4 | Phase 0 設計方向 = fast lane 境界（頻度基準: 日次で触る status/配置/メモは M3E-local 所有既定、repo 所有は typed `binds` 参照）/ micro-edit lane / 鮮度バッジ（出典 revision の UI 一級化）/ echo 抑止 |
| DC5 | codex への返答は define 収束後に統合送信（本 handoff がその本体） |
| DC6 | occurrence/entity 分離（binds モデル）採用。S16 へ小節追加 |
| DC7 | dogfooding シナリオの正本 = Phase 0 kiro spec 内（use case scenario として requirements/design に埋込） |

## 6. Use case 素材: dogfooding シナリオ（Phase 0 spec へ埋め込む正本素材）

前提: S16 実装済み世界。boardカード = occurrence（M3E-local 所有）、task/spec 定義 = repo `.m3e/` 所有、`binds` で接続。

- **場面1（速い書き込み）**: strategy board で `T412.status → in_progress`。authority 解決 = M3E-local、即時確定 8ms。カードは `binds: m3e://git.m3e-repo/task/conflict-backup` を持つ occurrence。
- **場面2（大域クエリと file-native handoff）**: Director が dispatch 前に大域 graph へ「この task が触る不変条件に依存する他 task」を query（indexedAt 付き応答）。Codex は clone した worktree の `.m3e/` + docs/ を file read だけで読む。code・spec・relation assertion（jsonl 追記）を同一 commit に積み、CI が schema/参照解決を検証。
- **場面3（遅延と echo）**: merge→indexer 遅延中に人間が手動で status 変更 → indexer の同期提案と衝突。bot が提案でなく直接 write する設計だと journal 二重化・undo 汚染。→ provenance 同値棄却が必須。
- **場面4（摩擦と退行）**: repo 所有 spec ノードの typo 1 文字に「PR 化」ダイアログ → ユーザーは回避して map 側に私的メモ → **dual-canon が UX 摩擦の沈殿物として再発**（IS-B、本シナリオ最重要知見）。Cmd+Z と repo revision 系の非接続も露出。
- **場面5（backup と offline）**: workspace backup が M3E-local のみに縮小（backup 境界 = 所有境界）。offline 時 board は動作（P1 堅持）、大域 query は「最終 materialization の cache 表示」へ劣化。

### IS 問題群

| ID | 問題 | 深刻度 |
|---|---|---|
| IS-A | fast lane 境界の未定義（ops 状態 vs 設計正本） | 高 |
| IS-B | 摩擦起点の dual-canon 退行 | **最高** |
| IS-C | echo/二重書き | 中 |
| IS-D | 鮮度の不可視（→手動同期→IS-C 誘発） | 高 |
| IS-E | undo と revision 系の非接続 | 中 |
| IS-F | 大域クエリのオフライン不能（P1 摩擦） | 中 |

## 7. AI 向け caching 方針（OP）と RAG 評価軸

### OP1〜OP5（Phase 0 requirements 化対象）

- **OP1**: 透過キャッシュ禁止。Director が dispatch 時に revision 固定の **context bundle**（context lockfile）を worktree へ置く。Codex は live query しない
- **OP2**: 読みは stale 許容、write-back の base-revision CAS で衝突検出（coherence protocol を作らない）
- **OP3**: キャッシュ生成者は indexer/projector と Director に限定。消費 agent は読み取り専用（AI 版 IS-B の防止）
- **OP4**: 射影の決定的 serialization（diff 有意味・provider prompt cache 適合・byte 検証可能）
- **OP5**: lifecycle は task/handoff に束ねる（dispatch = cache fill point、invalidation 問題を発生させない）

### RAG 評価軸 7 語 ＋ consumption mode 2 語（Glossary 登録案対象）

| 正規語 | 定義 | 担当機構 |
|---|---|---|
| reachability（到達性） | 存在する関連情報へ経路を辿れば必ず到達できるか | identity + binds + 大域 graph |
| latency | query から context 入手までの時間 | 射影 / context bundle |
| hop depth | 関係を何段辿るか | typed relation traversal |
| fan-out | 1 段あたり何件拾うか | **scope**（認知境界 = fan-out 制御装置） |
| specificity（特異度） | 拾った要素の該当判定精度（偽陽性抑制） | typed edge + provenance |
| freshness（鮮度） | context がどの revision 時点か | 鮮度バッジ / indexedAt |
| reproducibility（再現性） | 同じ判断を同じ context で再現・監査できるか | context lockfile / journal |

- **対話モード**: latency 予算 数秒（閾値超過は人間に context switch を強制）。優先: latency > specificity > fan-out 制御 > depth。materialized 射影から供給
- **自律モード**: latency は優先順位最下位に落ちる（消えるのではない — turn 数×待ち時間として throughput/コストに蓄積）。優先: reachability > specificity > depth > latency。live traversal 可
- 接続原理: **dispatch = 自律モードの latency 予算で対話モードの latency を買う行為**

## 7.5 追補（2026-07-19 確定）

- **JD1 確定**: ADR_008 Decision 3（M3E-owned accepted Deep graph の Gate 後 canonical runtime）を記載どおり承認。activation は Recovery Gate（portable snapshot + journal replay での復旧実証。backup は gate 根拠にしない）で拘束。
- **JD2 処理済み**: 指針原文は `docs/ideas/260718_llm_graph_protocol_directive_original.md` へ退避。PR #75 版が正本。
- **PR #75 merge 済み**（squash c743cf3）。
- **復旧語彙の定義**: journal = 操作の歴史（replay）/ backup = 物理複製（restore、エンジン依存）/ portable snapshot = 論理直列化（rebuild、エンジン非依存）。意味的保証は snapshot + journal。Rebuild Gate = 他者の正本から rebuild、Recovery Gate = 自己の復旧根拠から recover。
- **データ精錬度軸 D0〜D3**: D0 生data / D1 集計 / D2 傾向 / D3 法則・主張。各 Dn+1 は Dn の materialization（変換 + provenance 必須）。graph へ入るのは D3 と選ばれた D2 のみ。D0/D1 は identity 参照。
- **操作 3 平面**: 読み = openCypher / ISO GQL 語彙（独自 query 言語禁止）/ 書き = Command intent / 精錬 = materialize・aggregate・derive。
- **数学オントロジー命題**: `docs/ideas/260719_math_ontology_graphdb_thesis.md`。Neo4j は本命 use case 確定済みの遅延採用。Demand Gate query は数学コンテンツ運用からも採取。relationType 語彙は数学関係型を第一検証対象。
- 用語規律: 「見える化」不使用（可視化に統一）。判断リストは ID 必須（JDn 等）、機械採番選好。

## 7.6 検証フェーズ計画（2026-07-19 akaghef 指示。Phase 1 完了通知の受信で発動）

akaghef 指示: 実装完了通知を agmsg monitor で受け取ったら検証フェーズへ入る。検証方法は Director に委任。ただし (a) codex subagent を検証項目ごとに呼び出し、網羅的に・シナリオ達成を製品レベルで確認する、(b) computer use を用いた操作検証を行う、(c) agent が製品面から達成できない項目は UI/製品欠陥とみなし、フィードバック実装を回す。

- **V0 受領・突合**: PR / worktree を取得し、実装を spec（RQ1〜RQ11＋同乗要件 a〜d）と kiro-review で突合。
- **V1 検証マトリクス生成**: RQ1〜11、spec §16 テスト観点（正常/境界/失敗系）、dogfooding 場面 1〜5、Phase 0 完了条件から検証項目を機械採番（V-01, V-02, …）で列挙。
- **V2 項目別 codex dispatch**: 各項目を read-only worktree で codex subagent に実行させ、新鮮な証拠（コマンド出力・生成物・diff）を採取。実消費者として振る舞わせる（agent としての file read、CI validator 実行、rebuild drill、CAS/echo 試験）。
- **V3 製品レベル操作検証**: 実際の製品面（filesystem、CLI、viewer が関与するなら GUI）を computer use / Browser で操作して確認。codex が GUI 操作不能な場合はこの層のみ Director が直接実行（検証は Director 担当フェーズであり役割契約と整合）。
- **V4 agent-operability gate**: agent がシナリオを製品面から達成できない場合、それ自体を製品欠陥（IS 採番）として記録し、修正実装を codex へ dispatch → 再検証ループ。
- **V5 報告**: kiro-verify-completion 様式で akaghef へ証拠付き報告。主張のみの完了宣言は不可。見た目・美観の最終判断は従来通り akaghef へ確認依頼。

## 7.7 Phase 1 実装scope（2026-07-19 Claude Director承認）

| ID | 確定事項 |
|---|---|
| PI1 | 実装対象はrepo-local semantic sourceの最小specimen、`SourceDescriptor`、read-only file adapter、agent / CI validator、rename / revision / rebuild fixture tests |
| PI2 | Neo4j server、write adapter、Cypher schemaはPhase 1対象外 |
| PI3 | RAG評価軸7語 + consumption mode 2語、データ精錬度D0〜D3、query projection語衝突をGlossaryへ登録 |
| PI4 | RQ11としてopenCypher / ISO GQL語彙のread-only部分集合を採用し、独自query言語と`CREATE` / `MERGE` / `SET` / `DELETE`を禁止。変更はCommand平面へ送る |
| PI5 | specimenは数学ontologyをrelationTypeの第一検証対象として考慮する。ただし恒久語彙、serialization、配置は固定しない |
| PI6 | Phase 1完了後は§7.6のPDCA-C検証へ移り、Directorがmerge可否を判断する |

## 8. Codex への次アクション

1. **PR #74 修正**: §2 の MP2〜MP7 を Strategy.md へ反映（`resume --last` で継続可）。修正後、Director が re-review。
2. **Phase 0 spec-init**（PR 修正と並行可）:
   - Objective: S16 Phase 0「canon・authority・equivalence 確定」の kiro spec（requirements → design → tasks）draft
   - Inputs: 本 handoff 全文、Strategy.md S16、repository-canon-values.md、Scope_and_Alias.md、Data_Model.md
   - Scope: 定義のみ。実装・Neo4j 構築は含まない
   - Acceptance:
     - §6 dogfooding シナリオが use case 正本として組み込まれている
     - DC4 の 4 方向（fast lane 境界 / micro-edit lane / 鮮度バッジ / echo 抑止）が requirements 化されている
     - OP1〜OP5 の context bundle 要件が requirements 化されている
     - §7 の RAG 7 軸＋mode 2 語の Glossary 登録案を含む
     - S16.20 未決事項＋§3 Follow-up が「Phase 0 で決める / ADR へ送る / Phase 2 以降」に三分類されている

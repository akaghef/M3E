# Decision Pool

会話や作業中に出た判断を、正式文書に昇格する前にためる場所。
新しい項目を上に追加する。

---

## 2026-07-19-001

- Date: 2026-07-19
- Topic: general graph editor の Surface View 帰属（Disperse。System は別系譜のまま凍結）
- Status: working-agreement
- Decision:
  - **general graph editor（一般 property graph の編集 UI）は Disperse に載せる**。新しい Surface View 名は増やさない（steering 拘束規則1）。
  - **System view は LangGraph 的 system diagram の系譜**（PJ04 / MDD / Template System 線）であり、general graph editor とは全く別物。**凍結を維持**する。general graph 需要を理由に System を解凍しない。
  - これは 2026-07-18-002（Tree 最優先 / Disperse 最大エフォート / 他凍結）と整合: general graph editor は Disperse 主戦場の中身になる。
  - コンセプト正本 = playground 成果物群: LLM Graph Conversation Protocol（`04_Architecture/`、Phase 0 / federated 版）+ Agent Orrery（`docs/tasks/agent_network_dashboard_reference_260707/`）。
- Why: System と general graph は「ノードとエッジがある」見た目が似るだけで、System = 実行系 diagram（LangGraph 的 flow）、general graph editor = 知識・関係の property graph 編集と意味論が異なる。混ぜると表示意味が衝突する（2026-06-06-001 の教訓と同型）。
- Next: spec 設計は Federated_Semantic_Source + ADR_008 + LLM Graph Conversation Protocol（graph ops / owner routing）前提。表示・編集は Disperse(force-link) + `@xyflow/react` / `elkjs` 優先（2026-06-06-001 準拠）。kiro-discovery で枠切り後、Codex に spec ドラフト dispatch。
- Source: 2026-07-19 akaghef 指示「system diagramはlanggraph的な方向性なので(ぜんぜん違う 凍結したままにする)、disperseが正しい」
- Promoted: （未）

## 2026-07-18-003

- Date: 2026-07-18
- Topic: S16 — federated canonical source と Neo4j role の concern 分離
- Status: accepted-for-phase-0
- Decision:
  - repository、Obsidian、M3E-local、external provider は durable concern ごとに局所 canonical source を持ち、同じ concern の canonical owner は一つにする。
  - 外部 source が所有する content / assertion を Neo4j に載せた record は materialization とする。
  - M3E が所有する accepted Deep entity / assertion は、activation gate 通過後の Neo4j canonical runtime 対象とする。portable recovery evidence を別 failure domain に維持する。
  - proposal、pending assertion、ownership transfer は journal を canonical source とし、Mermaid / TOON は会話用 projection とする。
  - UI、human、AI、bot、CI の確定 write は共通 Command boundary で owner へ route する。M3E-owned accepted graph だけが Neo4j owner adapter に到達する。
  - Rapid occurrence と Deep entity は別 identity とし、many-to-many entity binding で接続する。
  - Neo4j shadow は、実運用由来の cross-source query 3 件を input、expected result、source revision 付きで固定するまで開始しない。
  - SQLite は M3E-native Rapid local persistence として継続し、PostgreSQL / collaboration state / global graph を別 concern として選定する。
- Why: 単一 SQLite へ repository 情報を複製すると Git / bot / CI から正本が見えず、双方 write で dual-canon になる。一方、Neo4j を全 source content の唯一の正本にすると局所 ownership、diff、offline recovery、provider responsibility を失う。既存の「Neo4j 正本」判断は M3E-owned accepted graph concern に限定すれば両立する。
- Next: repository-local semantic source の file-read use case を先に実証し、3 件の query evidence が揃った時点で Neo4j deployment / edition / canonical-subgraph recovery ADR を起票する。Principle への昇格は現時点では行わない。
- Source: 2026-07-18 の本スレッド、PR #74、Claude Fable review、同日 Decision `2026-07-18-001`
- Promoted: [../01_Vision/Strategy.md](../01_Vision/Strategy.md), [../03_Spec/Federated_Semantic_Source.md](../03_Spec/Federated_Semantic_Source.md), [../04_Architecture/Federated_Semantic_Graph.md](../04_Architecture/Federated_Semantic_Graph.md), [../04_Architecture/LLM_Graph_Conversation_Protocol.md](../04_Architecture/LLM_Graph_Conversation_Protocol.md), [../09_Decisions/ADR_008_Federated_Canonical_Sources.md](../09_Decisions/ADR_008_Federated_Canonical_Sources.md)

## 2026-07-18-002

- Date: 2026-07-18
- Topic: Surface View の投資優先度（Tree → Disperse、他は凍結）
- Status: working-agreement
- Decision:
  - **Tree = 最優先**。ほぼ出来ているので、仕上げ（完成度・検証固定）に最初のリソースを充てる。
  - **Disperse = 次点。最大のエフォートを割く**主戦場。
  - **Axial / Radial / System = 放置（凍結）**。新規の実装・spec・検証投資をしない。non-regression（既存挙動を壊さない）だけ守る。
  - 検証直積（Development_System.md §2.4）の第3軸はこの優先度で剪定する: golden 表・lab・目視ゲートの対象行は Tree / Disperse のみ。凍結 view のセルは台帳上 `frozen` として明示し、空欄と区別する。
- Why: 5 view 全部に検証・実装投資すると直積が爆発する。価値が集中している Tree（主力・完成間近）と Disperse（次の主戦場）に絞ることで、乗算→加算の分解が実効化する。
- Next: 検証マトリクス台帳・seam spec 起案時は Tree / Disperse 行のみ展開。凍結 view に触る変更が必要になったら Decision_Pool で解凍を判断。
- Source: 2026-07-18 akaghef 指示「Treeを最優先(ほぼ出来てる)、Disperseを次(一番エフォート割く)。他は放置。という思想も刻んで」
- Promoted: [../06_Operations/Development_System.md](Development_System.md) §2.4 / `.kiro/steering/ui_view_taxonomy_and_ports.md` 拘束規則4

## 2026-07-18-001

- Date: 2026-07-18
- Topic: LLM ↔ property graph の会話プロトコル（Neo4j 正本 / Mermaid+TOON projection / graph ops 正規化）
- Status: working-agreement
- Decision:
  - Neo4j を正本、Mermaid + TOON を会話用 projection とする（Neo4j → context projection → LLM edit → graph operations → Neo4j）。
  - LLM の出力を Mermaid や TOON そのものとして保存せず、必ず graph operation（`ops{op,target,key,value}`）へ正規化してから DB に反映する。
  - 役割: CR1 Mermaid=局所 topology（認知的構造把握）/ CR2 TOON=属性・provenance・state・schema / CR3 Neo4j=完全な property graph と query / CR4 graph ops=会話→DB の正規化境界。
  - 会話 context は全グラフでなく `Expand(V_focus, k, relation filter)` の k-hop 部分グラフを射影する。
  - Mermaid edge label を識別子として解析しない。edge ID はコメント（`%% edge:E41`）等で明示する。
  - この構成では JSON を会話面から排除する合理性がある。
  - Scope note (`2026-07-18-003`): `Neo4j 正本` は M3E-owned accepted Deep graph concern に限定する。Git / Obsidian / provider-owned record は materialization、proposal / pending transfer は journal、Mermaid + TOON は `context projection` とする。
- Why: これはファイルフォーマットでなく LLM と property graph の間の会話プロトコル。projection を正本化すると往復で drift するため、正規化境界（ops）を唯一の書き込み経路にする。
- Next: M3E データ層 / agent graph 系の新規 spec はこのプロトコルを前提に設計する。
- Source: 2026-07-18 akaghef 指針（stow 指示）
- Promoted: [../04_Architecture/LLM_Graph_Conversation_Protocol.md](../04_Architecture/LLM_Graph_Conversation_Protocol.md)
## 2026-06-06-001

- Date: 2026-06-06
- Topic: pipeline / system graph UI reference asset の M3E 取り込み
- Status: working-agreement
- Decision:
  - X post の可視化 UI は、Markdown renderer ではなく、M3E の pipeline / system graph surface 参考 asset として扱う。
  - 適用先は `Axial.subtype=pipeline` と `System.subtype=architecture`。新しい Surface View 名は増やさない。
  - M3E へ移植する要素は typed card、port、left-to-right flow、selected-path focus、right inspector、minimap、trace replay。
  - 実装に進む場合は `@xyflow/react` + `elkjs` を優先し、新規の大規模 graph layout を自作しない。
  - 既定の Rapid tree viewer は置換しない。dark palette / saturated node color は system / workflow surface 限定の候補とする。
- Why: 大規模 AI system を文書だけで追うより、GraphSpec / Contract Tree / Run trace を可視化する surface として有用だが、既存の calm Rapid tree 方針と混ぜると表示意味が衝突するため。
- Next: read-only preview route で AppState + GraphSpec から flow UI を表示する adapter を切り出す。実装時は selection inspector と label overlap の Playwright 検証を先に置く。
- Source: https://x.com/GianMattya/status/2062294853464265004 とこのスレッドでの UI 取り込み指示
- Promoted: [../04_Architecture/Pipeline_UI_Reference.md](../04_Architecture/Pipeline_UI_Reference.md), [../03_Spec/map_layout_modes.md](../03_Spec/map_layout_modes.md)

## 2026-04-14-001

- Date: 2026-04-14
- Topic: batch review (17 件) の決定と両立案採用
- Status: working-agreement
- Decision:
  - **Cloud Sync**: auth=email magic link (OAuth 追加は未決) / Q2 DTO=`shared/types.ts` / Q3 conflict=scope-level (subtree 単位で CRDT 差し替え可能な抽象を残す / 未解決) / Q4 Supabase=既存プロジェクト / Q5 暗号化=**user 明示要求まで放置** (no encryption initially)
  - **Alias Impl**: Q1 write-alias scope = everything incl metadata (将来 per-alias mode toggle で独立保持も両立) / Q2 named wrappers = skip (reparentNode + deleteNode で足りる) / Q3 scoped-API × alias = API 引数で挙動制御 (default 可視、引数で隠す)
  - **Markdown Viewer**: 基本方針=**軽量** (見出し・強調のみ、表なし、フォントサイズ切替) / Q1 lib=hand-written renderer 継続 / Q2 Mermaid=`beta/public/vendor/mermaid.min.js` vendor / Q3 preview=ノード属性 `markdown:true` で opt-in
  - **Red Team**: Q1 branch=`dev-red` ベース + `audit/<date>-<domain>` トピック併用 / Q2 autonomy=read-only audit / Q3 初回 scope=full security sweep (CSRF / LAN / 偽装 / 入力検証 / 公開URL / Supabase / APIキー)
  - **Rapid Deep Binding**: Q1 domain=hierarchical (`math.topology.knot`) / Q2 role=固定リスト (object/representation/move/invariant/theorem/method) / Q3 syntactic=専用テーブル / Q4 span=char offset (v1、将来 token range 昇格) / Q5 encoder=明示ボタンのみ
  - **Node Decoration**: 保存キー=`attributes['m3e:style']` / swatch=mlx 配色 (importance=yellow tints / urgency=blue tints) / color matrix=mlx Method 2 + ステータス色 (未実行=緑 / 完了=グレー) の重ね合わせ / precedence=view-mode 切替 (`U*I view`=mlx 自動 / 通常=手動) ← 未解決 / hotkey=ノード編集モード内で `r`/`b`/`g` 単打 + テンキーで U*I 一発入力 (要追加議論) ← 未解決
  - **Link API**: Q1 API shape=dedicated REST endpoints / Q2 duplicate=allow / Q3 self-link=allow (ループ描画ロジックは follow-up)
- Why: 17 件の review Q を一括解決し、実装を止めずに dispatch を継続するため。両立可能な選択肢は片方を排除せず per-mode / per-arg トグルで将来拡張を残す設計にした
- Next: map の `reviews/*/Qn` に `selected="yes"` 反映済 (22 Q 削除 + 未解決 5 件残置)。for-akaghef サマリ [../for-akaghef/260414_review_options_summary.md](../for-akaghef/260414_review_options_summary.md) 参照。Node Decoration の未解決 2 件は U*I view mode 実装時に再議論
- Source: 2026-04-14 の batch レビュー会話、PR #48-#53 dispatch
- Promoted: （未）

## 2026-04-14-002

- Date: 2026-04-14
- Topic: X (Twitter) を Tech Radar として M3E に取り込む方針
- Status: working-agreement
- Decision:
  - 用途 = akaghef が like/bookmark した投稿から新ツール情報を吸い上げ、M3E への統合適合性を評価 (adopt/trial/assess/hold rating)
  - 公式 X MCP は**存在しない** → community `chrislee973/twitter-bookmark-mcp` サイドカー経由で P1 実装 (credential は MCP 側、M3E は API key を持たない)
  - P2 以降は X API v2 直接 (~$5/月, PPU tier)。scraping は ToS リスクで却下
  - Entity 抽出 = haiku で post→tool 名抽出、sonnet で統合適合性評価
  - Storage = map primary (`DEV/Tech Radar/<tool>`)、SQLite cache
  - Poll = P1 manual trigger、P2 は 6h cron
  - Scope = P1 bookmarks のみ、likes は P2
- Why: X が akaghef のツール発見チャネルであり、手動コピペを自動化する価値が高い
- Next: Q1-Q7 を map `reviews/X Tech Radar/` に pool 済。codex brief [../../backlog/codex-x-tech-radar.md](../../backlog/codex-x-tech-radar.md) 作成済。P1 実装は Q レビュー後に codex dispatch
- Source: 2026-04-14 PR #53 の team 設計作業
- Promoted: [../03_Spec/x_tech_radar.md](../03_Spec/x_tech_radar.md)

---

## 2026-04-02-002

- Date: 2026-04-02
- Topic: Linear 変換 UI は Tree 右側パネルで提供する
- Status: working-agreement
- Decision: Rapid では Tree の右側に current scope 用 Linear テキストパネルを配置し、Tree 選択と行選択を同期する。Linear 編集は即時反映せず Apply 時に一括反映し、失敗時は fail-closed で中断する。
- Why: 構造と文章の対応を見やすくしつつ、曖昧入力による部分破壊を防ぐため
- Next: parser/reconcile の回帰テストを追加して誤変換の再発を防止する
- Source: 2026-04-02 の UI 仕様確定と実装作業
- Promoted: [../03_Spec/Linear_Tree_Conversion.md](../03_Spec/Linear_Tree_Conversion.md)

## 2026-04-02-001

- Date: 2026-04-02
- Topic: Linear <-> Tree 変換を scope 基準で設計する
- Status: working-agreement
- Decision: 正本は Tree のまま維持し、Linear は入出力インターフェースとして扱う。既定の変換単位は `currentScopeId` の部分木とし、L1（インデント）を可逆優先、L2（Markdown）を準可逆として段階導入する。
- Why: 入力速度を上げつつ、主構造（親子）と認知境界（scope）を壊さないため
- Next: L1 export/import の最小実装と round-trip テストを追加する
- Source: 2026-04-02 の Linear/Tree 変換ビジョン確認
- Promoted: [../03_Spec/Linear_Tree_Conversion.md](../03_Spec/Linear_Tree_Conversion.md)

## 2026-04-01-003

- Date: 2026-04-01
- Topic: graph-level `Link` の Beta 実装前提仕様
- Status: working-agreement
- Decision: `Link` は `Edge` と別の overlay relation として `AppState.links` に保持し、node-level `link` 文字列とは分離する。`Link` は layout に参加せず、source/target node ID を参照し、broken endpoint を含む状態は保存時に拒否する。
- Why: 構造木と非木関係線を混同せず、将来の relation line 実装を最小データ構造から始められるようにするため
- Next: `03_Spec/Data_Model.md` と import/export 境界文書へ graph-level `Link` の型と保存制約を追加する
- Source: このスレッドでの `Link` 実装状況確認と仕様追記依頼
- Promoted: [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md), [../03_Spec/Import_Export.md](../03_Spec/Import_Export.md)

## 2026-04-01-002

- Date: 2026-04-01
- Topic: `scope` / `alias` 仕様の訂正
- Status: working-agreement
- Decision: target 実体 delete は alias 残存を理由に拒否せず、alias 側を broken 状態へ遷移させて表示名を `元の名前 (deleted)` とする。alias には write 権限設定を持てるようにし、同一 scope 内 alias も許可する。
- Why: delete を過度に阻害せず参照喪失を分かりやすく残し、将来の alias 経由編集や同一 scope 内参照の用途を塞がないため
- Next: `03_Spec/Scope_and_Alias.md` の delete / 権限 / 同一 scope 制約を訂正し、Beta model での最小表現に落とす
- Source: このスレッドでの仕様修正指示
- Promoted: [../03_Spec/Scope_and_Alias.md](../03_Spec/Scope_and_Alias.md)

## 2026-04-01-001

- Date: 2026-04-01
- Topic: `scope` と `alias` の Beta 実装前提仕様
- Status: working-agreement
- Decision: `folder` は子 scope の入口ノードとして扱い、実体ノードは単一 scope 所属、他 scope からの再利用は `alias` 経由のみとする。`alias` は read-only 参照ノードで、`alias -> alias` は禁止し、対象実体の削除は alias 解消前は拒否する。
- Why: 認知境界を UI とモデルの両方で一貫して扱い、複製による整合崩壊と削除事故を防ぐため
- Next: `03_Spec/Scope_and_Alias.md` を Beta 実装に使える粒度へ拡張し、後続で model/save-load への反映単位を切り出す
- Source: このスレッドでの `scope` / `alias` 仕様整理依頼
- Promoted: [../03_Spec/Scope_and_Alias.md](../03_Spec/Scope_and_Alias.md)

## 2026-03-30-004

- Date: 2026-03-30
- Topic: MVP テストレイヤーと CI 段階導入方針の運用基準化
- Status: working-agreement
- Decision: MVP 期間は Test and CI/CD Guide を基準として、Model/SaveLoad/Layout-HitTest を優先しつつ CI Stage A を先行導入する
- Why: 操作品質の検証とデータ安全性の検証を分離して運用し、壊れ込みの早期検知を可能にするため
- Next: Stage A の最小 CI ジョブを実装し、PR 前ゲートを運用に組み込む
- Source: このスレッドでのテスト/CICD 文書拡充依頼
- Promoted: [Test_and_CICD_Guide.md](./Test_and_CICD_Guide.md)

## 2026-03-30-003

- Date: 2026-03-30
- Topic: Freeplane-first から独自描画エンジン方針へ転換
- Status: accepted
- Decision: Freeplane は参考実装および `.mm` 互換入力形式として扱い、描画エンジンと操作系は M3E 側で自作する
- Why: M3E 固有の研究思考支援 UI は Freeplane の外側の補助レイヤーではなく、表示と操作の設計そのものに宿るため
- Next: MVP 定義、方針文書、ADR を独自描画前提へ更新する
- Source: このスレッドでの方針転換の会話
- Promoted: [../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)

## 2026-03-30-001

- Date: 2026-03-30
- Topic: 会話ベースの決定を集約する文書運用を先に作る
- Status: accepted
- Decision: 会話で出た決定や仮決めは、まず `06_Operations/Decision_Pool.md` に記録してから、必要に応じて `Spec` `Architecture` `ADR` へ昇格させる
- Why: 開発初期は会話量に対して正式文書化が追いつきにくく、決定の散逸と重複が起こりやすいため
- Next: 以後の会話判断はこのプールへ記録し、反映先ができたら `Promoted` を更新する
- Source: このスレッドでの運用方針決定
- Promoted: [Documentation_Rules.md](./Documentation_Rules.md)

## 2026-03-30-002

- Date: 2026-03-30
- Topic: SVG を先に使う方針
- Status: working-agreement
- Decision: MVP 立ち上げでは SVG を優先候補とし、レイアウト・モデル・描画を分離した構成で進める
- Why: 初期実装速度と UI デバッグ容易性を優先しつつ、将来の Canvas 移行余地を残すため
- Next: `04_Architecture` 側に描画インターフェースの境界を整理する
- Source: このスレッドでの MVP 実装方針の会話
- Promoted: -

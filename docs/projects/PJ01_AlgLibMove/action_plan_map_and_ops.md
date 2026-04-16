---
project: AlgLibMove
date: 2026-04-16
topic: dogfood_reflection §1 / §2 の sub-item 別アクション分解
source: backlog/dogfood_reflection_2026-04-16.md
status: draft (網羅優先・推敲前)
---

# 本 md の使い方

- source (`dogfood_reflection_2026-04-16.md`) §1.1〜§2.10 を 1 対 1 で breakdown した作業台帳。
- 1 sub-item = 1 section。`問題再定義 / 実行手順 / 判断点 / 議論の場 / コスト / 前提` の 6 ブロック固定。
- 独立実行可の項目はそのまま着手してよい。`判断が必要な点` がある項目は akaghef と live / codex review / map 内議論のどれかで decision を取ってから進める。
- コスト欄の S=〜30min / M=〜2h / L=半日以上。blocking 列で他 sub-item の前提になるかを明示。
- 着手順の推奨は §8 (source) に従いつつ、本台帳の「前提」欄で dependency を読むこと。
- 元 md の記述は重複しないので、詳細・具体例が必要なら source を当たる。
- 議論の場に `map 内 (facet X)` と書いてある項目は、まず map に叩き台ノードを作ってから live 相談する想定。
- 「codex review request」は backlog/codex_review_request_*.md の形式で Codex に投げる議題。
- 完了後は本 md の該当 section に `[done: YYYY-MM-DD]` を頭に付けて残す (削除しない)。

---

## §1.1 ラベルのみ症候群（description 欠落）

1. **問題再定義**: ノード name だけで description/source が無く、意味が親名からの推測に依存している。
2. **実行手順**:
   - 既存 facet 1 / 5 の全ノードを m3e API で dump し、description 空のものを list に吐く。
   - facet × ノード種別ごとの必須フィールド案を 1 表にまとめる (`name / description(1-3行) / source(file:line) / tag`)。
   - `backlog/NODE_FORMAT.md` を新規起こし、必須フィールド・テンプレ例を記述。
   - `m3e-map` skill の SKILL.md にテンプレ例を埋める PR 案を下書き。
   - description 空ノード top-20 を手で埋め、所要時間を実測。
   - 実測から 1 ノードあたり avg sec を算出、残ノード bulk 埋めコストを見積もる。
   - 見積を port_log に投入し akaghef に go/no-go を仰ぐ。
   - 承認後 sub-agent に bulk 埋めタスクを委譲（source file:line 抽出 script 経由）。
   - description 充足率を facet 12 progress に metric として追加。
3. **判断点**: 必須フィールドの厳格度 (hard block vs warning) / source 欄のフォーマット (file:line vs commit hash 併記) / 既存ノード backfill の優先 facet 順。
4. **議論の場**: `backlog/NODE_FORMAT.md` (新) を叩き台に live 会話 1 回。
5. **コスト**: M (format 策定) + L (backfill)、§1.2/§3.1 を blocking。
6. **前提**: 無し（alias バグ §1.4 とは独立に進められる）。

## §1.2 垂直入れ子過剰

1. **問題再定義**: 中間グルーピングノード (`methods/`, `operator/`) で depth が嵩み、1 画面に sibling が出ない。
2. **実行手順**:
   - 全 facet を走査して depth ≥ 4 の subtree を listing する script を書く。
   - 各中間ノードについて「情報を持つ / 持たない」を手で判定。
   - 持たないノードを「tag 属性へ降格」候補としてマーク。
   - tag schema を定義する（tag 名前空間 / 許容値 / 多重可否）。
   - 1 facet (facet 1 VectAlg) で降格を pilot 実施、before/after screenshot を取る。
   - pilot 結果を port_log / live で共有。
   - 承認後に残 facet へ横展開する sub-agent プロンプトを書く。
   - 展開後 depth 分布を再測、平均 depth を facet 12 に記録。
3. **判断点**: tag 多軸化をどこまで許すか / 降格対象の境界判定 / 既存 link の再配線方針。
4. **議論の場**: facet 1 内に `_refactor_pilot` subtree を作って live で見せる。
5. **コスト**: L、§1.7/§1.14 の「俯瞰」系を unlock する意味で blocking 度高。
6. **前提**: §1.1 の NODE_FORMAT で tag フィールドが定義済みであること。

## §1.3 link 種別の過剰増殖

1. **問題再定義**: link 種別 15+ が揺らいで使われ、方向・inverse が規約化されていない。
2. **実行手順**:
   - 全 link を dump し、種別ごと出現頻度・使用 facet を集計する。
   - 上位 10 種に統廃合する mapping 表を起案する。
   - 各 link 種別に domain / range / inverse / transitive を明記した定義ノードを facet (候補: facet 13 meta) に作る。
   - migration script で旧種別 → 新種別に一括置換する dry-run を回す。
   - dry-run 結果を diff 表示、conflict を手で解決。
   - 本番適用し、旧種別 lint を m3e 側に追加する feature request を §6 に投入。
   - 規約を `backlog/LINK_TYPES.md` に固定。
   - sub-agent プロンプトにこの表を埋め込む。
3. **判断点**: どの 10 種に絞るか / `realizes` vs `implements` vs `instance_of` の境界 / inverse を別種別にするか属性にするか。
4. **議論の場**: `backlog/LINK_TYPES.md` (新) + codex review request 1 本。
5. **コスト**: L、§1.10 オントロジー層の土台になるので blocking。
6. **前提**: 無し、ただし §1.4 alias バグが混入していない状態が望ましい。

## §1.4 alias の曖昧運用（SSOT 未達）

1. **問題再定義**: canonical / alias 判別不能、編集伝播・削除 guard・逆引きが未実装で SSOT が崩れている。
2. **実行手順**:
   - 既知の alias 疑い事例 (facet 6 / facet 2 ↔ scope 1) を再現手順付きで列挙する。
   - alias 1 件を編集して canonical が変わるか POST 実験する。
   - canonical を削除して alias の挙動を観測する。
   - 観測結果を `backlog/alias_bug_repro_2026-04-16.md` に書く。
   - M3E 本体の alias 実装箇所 (viewer + store) を grep で特定する。
   - 期待仕様（canonical flag 表示 / 委譲 / guard / 逆引き）を仕様書化する。
   - 仕様を codex review に投げ設計 option を取る。
   - feature branch を dev-beta から切り修正を入れる。
   - alias API test を追加する。
3. **判断点**: 「編集委譲」のセマンティクス（alias 編集 → canonical 即更新 or proposal）/ 削除 guard の UX / 既存 18 alias の扱い。
4. **議論の場**: `backlog/alias_bug_repro_2026-04-16.md` + codex review request。
5. **コスト**: L、§6.1 最優先、他の map refactor 全てを blocking。
6. **前提**: 無し。最初にやる。

## §1.5 表による情報圧縮力未活用

1. **問題再定義**: 横比較すべき同形 sibling が縦 subtree に分解され、比較不能になっている。
2. **実行手順**:
   - 今のマップから table 最適な subtree を 5 個抽出する (Hopf 規約 / 決定行列 / 進捗行列 / 規約一覧 / 3 algebras × 5 maps)。
   - 各 table の schema（column 名・型）を書く。
   - M3E 側 `table-node` の data model を設計する (subtree root に schema、children が row)。
   - viewer に matrix view component を追加する設計案を書く。
   - 既存 tree 表現から table 表現への migration 規約を決める。
   - prototype として Hopf 規約 table を 1 件作り screenshot を取る。
   - 残 4 table を横展開する。
3. **判断点**: schema をノード属性で持つか別 meta ノードか / table cell の編集 UX / tree と table の双方向同期を取るか。
4. **議論の場**: M3E 本体 PR proposal + live。
5. **コスト**: L、§1.9 グラフ視覚化と並ぶ認知補助層の骨格。
6. **前提**: §1.1 (description) があるほうがセル中身が充実する。

## §1.6 装飾 / 視覚階層なし

1. **問題再定義**: 全ノードが同形で、importance / status / recency / completion が視覚的に読めない。
2. **実行手順**:
   - 装飾軸 4 つ (importance / status / recency / completion) の算出ロジックを仕様書化。
   - 自動算出 (link 流入・更新時刻・属性充足率) と手動タグの切り分けを定義。
   - viewer CSS の visual token (color / size / border / opacity) を設計する。
   - store に derived field として 4 軸を計算する layer を追加する。
   - prototype を facet 1 で 1 軸 (status) だけ実装し screenshot を取る。
   - akaghef の色覚 / 好みを反映し調整する。
   - 残 3 軸を順次実装する。
   - hot/cold path の切替 UI を足す。
3. **判断点**: 自動 vs 手動の境界 / importance の重み付け係数 / status の状態機械定義。
4. **議論の場**: live で prototype を見ながら。
5. **コスト**: L、§6.1 高優先。
6. **前提**: §1.1 で status / completion の属性が定義されていると早い。

## §1.7 ノード粒度と Review 粒度の不一致

1. **問題再定義**: method 単位の細粒度マップでは、横断的な review 問い (axiom 整合) に答えるのに不向き。
2. **実行手順**:
   - review 用 projection facet `facet_review_lens` を新設する。
   - 3 algebras × 5 structure maps の 15 セル matrix をそこに置く。
   - 各セルに canonical の method / test / concept への link を張る。
   - `m3e export --scope=review --format=codex-review` の CLI draft を設計する。
   - export が codex_review_request_*.md の本文を吐けるようにテンプレ化。
   - 今夜の Hopf/HD review でそのまま使って実効性を測る。
   - authoring lens と review lens の切替 UI を検討。
3. **判断点**: projection は別 facet か同 facet の view mode か / matrix セルに直書きするか link のみか。
4. **議論の場**: map 内 `facet_review_lens` の叩き台を作って live。
5. **コスト**: M。
6. **前提**: §1.3 link 種別が安定しているとリンクの意味が壊れない。

## §1.8 depth/breadth の時間軸規約未定義

1. **問題再定義**: temporal / taxonomic / dependency の axis 宣言が無く、sub-agent 間で時系列方向が揺れる。
2. **実行手順**:
   - 規約 `depth=時間 / breadth=並列` を 1 枚の規範文書に書く (`backlog/AXIS_RULE.md` 新)。
   - subtree root の属性 `axis: temporal | taxonomic | dependency` を schema 化。
   - 既存 facet 3 / 7 / 12 の subtree root に axis 属性を backfill する。
   - axis 違反（temporal subtree に taxonomic が混入など）を検出する lint script を書く。
   - lint を CI 相当で定期実行するか検討。
   - sub-agent プロンプトテンプレに axis 規約を埋める。
3. **判断点**: 既存 facet の backfill で衝突する subtree の扱い / axis 混在を許すか禁止か。
4. **議論の場**: `backlog/AXIS_RULE.md` 起案 → live 1 回。
5. **コスト**: M、§3.3 と連動。
6. **前提**: 無し。

## §1.9 グラフ視覚化機能欠落

1. **問題再定義**: facet 3/4/7 はグラフなのに tree+link primitive でしか表現されず、DAG / cycle / sequence が見えない。
2. **実行手順**:
   - subtree の link 集合を mermaid (graph LR / sequenceDiagram) に変換する関数を書く。
   - subtree root 属性 `visual_mode: tree | flow | sequence | matrix | swimlane` を追加。
   - viewer 側で visual_mode に応じた renderer を分岐する。
   - facet 3 (call_flow) を mermaid sequenceDiagram 化する pilot。
   - facet 4 (dependency) を DAG 化する pilot。
   - facet 7 (dataflow) を swim lane 化する pilot。
   - 各 pilot の screenshot を dogfood reflection に追記する。
3. **判断点**: どの mermaid subset をサポートするか / 大規模 graph の折り畳み / 編集は tree 側だけか graph 側でも可か。
4. **議論の場**: M3E 本体 PR + codex review。
5. **コスト**: L、§6.2 高優先・facet 3/4/7 全体を unlock。
6. **前提**: §1.3 link 種別の安定。

## §1.10 オントロジー手法未活用

1. **問題再定義**: class/instance, property 定義ノード, inverse, axiom, query, 推論が未実装でオントロジー層が薄い。
2. **実行手順**:
   - 未活用 7 項目それぞれに対して 1 段落の仕様 stub を書く (`backlog/ONTOLOGY_ROADMAP.md`)。
   - 依存グラフ（どれが前提か）を図示する。
   - MVP subset を選ぶ（推奨: class/instance 分離 + inverse 自動 + property 定義ノード）。
   - MVP を facet 5 (Hopf concept) で pilot する。
   - axiom ノード (antipode 必須) を 1 件作り違反検出 script の prototype を書く。
   - SPARQL 相当は後回しとして明示する。
   - dev-beta 側に実装 issue として切る。
3. **判断点**: OWL-lite 相当までやるか primitive に留めるか / 既存 tree との互換戦略 / 推論エンジンを自前か外部ライブラリか。
4. **議論の場**: `backlog/ONTOLOGY_ROADMAP.md` + codex review request (設計 option レビュー)。
5. **コスト**: L（長期）。
6. **前提**: §1.3 link 種別統廃合、§1.4 alias SSOT、§1.5 table-node のどれか 1 つ以上。

## §1.11 collapse / visibility の default 方針欠落（+ viewer context）

1. **問題再定義**: visibility が静的で viewer 知識状態に適応せず、俯瞰 or 詳細のどちらかが死ぬ。
2. **実行手順**:
   - viewer profile schema を設計する (`known_topics`, `current_phase`, `current_facet`)。
   - akaghef 用 profile を 1 件書き、`viewer_profile/akaghef.json` として commit。
   - ノード側 visibility rule DSL を定義する (`collapse_if: viewer.known(topic) and not in_focus`)。
   - 5 つの view mode (teaching / research / implementation / review / overview) の default rule を書く。
   - viewer にモード切替 hotkey を足す (`1〜5`)。
   - prototype として facet 5 に akaghef profile × implementation mode を適用。
   - 感触を live で確認、rule を調整。
   - §1.6 装飾軸と統合する (visibility と importance の合成)。
3. **判断点**: profile を誰がどう更新するか (手動 vs 使用履歴から学習) / rule DSL の表現力 / mode 間の遷移で state を保つか。
4. **議論の場**: `viewer_profile/akaghef.json` 叩き台 + live。
5. **コスト**: L、§6.1 最優先の 3 つ目。
6. **前提**: §1.6 装飾軸のうち status / completion 属性が先にあると rule が書きやすい。

## §1.12 テキストファイルとの役割分離

1. **問題再定義**: timeline / backlog / port_log / debt_register / map の境界が未定で、書き落とし・重複が発生する。
2. **実行手順**:
   - source §1.12 の表をそのまま `backlog/TXT_MAP_SPLIT.md` に転記し正式化する。
   - map ノードに `log_ref` 属性を追加する schema 変更を入れる。
   - 既存 decision ノード top-10 に `log_ref` を backfill する (手動)。
   - sub-agent プロンプトに「時間軸なら txt、関係なら map」規約を埋める。
   - 過去 1 週間の書き込みを監査し、媒体違反を列挙する。
   - 違反を適切な媒体に移送する。
3. **判断点**: log_ref の解決方法 (file:line の静的 link / live editor jump) / 媒体違反の扱い (厳格 or 警告)。
4. **議論の場**: `backlog/TXT_MAP_SPLIT.md` + live。
5. **コスト**: M。
6. **前提**: 無し。

## §1.13 スナップショット欠落

1. **問題再定義**: マップ状態の時間軸スクラブ・named snapshot・diff が無く、過去復元と undo が不能。
2. **実行手順**:
   - M3E の map データ永続先を確認する (現状どこに JSON が落ちているか)。
   - それを git 配下に移す PR を書く (既に git 配下なら skip)。
   - session 終端 / phase 遷移で auto commit する hook を `update-config` skill で追加する。
   - named snapshot 用 tag コマンド (`m3e snapshot --name=phase-A-complete`) を設計する。
   - snapshot 間 diff view UI の仕様を書く。
   - time scrub UI（過去任意時点の閲覧）を設計する。
   - MVP (auto commit のみ) を先に実装、named と diff は phase 2。
3. **判断点**: commit 粒度 (全変更 vs 意味的境界) / bin vs JSON の git 相性 / diff UI を map 側 or git 側 tool に任せるか。
4. **議論の場**: live + codex review（auto commit hook 設計）。
5. **コスト**: M (MVP) + L (named/diff)。
6. **前提**: 無し。すぐ着手可能。

## §1.14 プロジェクト進行度の可視化欠落

1. **問題再定義**: facet 12 progress が生データ置き場で、ROOT に集計ビューが無く一瞥で進行度が読めない。
2. **実行手順**:
   - progress に必要な metric を列挙する (phase, facet health, MSNF badge, blocker count, burn-down)。
   - 各 metric の source query を書く (どの facet のどの属性を集計するか)。
   - ROOT node に `view: aggregate` を持たせる schema を追加。
   - aggregate view の renderer (数値 card + sparkline) を viewer に実装する。
   - phase meter を最初に実装し screenshot。
   - facet health dashboard を次に実装。
   - burn-down を最後に実装（時系列 snapshot 前提）。
3. **判断点**: 集計更新頻度 (リアルタイム vs session 終端) / どの metric を MVP に含めるか / ROOT を汚すか専用 facet を作るか。
4. **議論の場**: live で metric 一覧 review。
5. **コスト**: M〜L。
6. **前提**: §1.13 snapshot（burn-down に必要）/ §1.1 description 充足率 metric。

---

## §2.1 ROOT の phase_marker が機能していない

1. **問題再定義**: phase_marker の更新タイミングが未定 + 自動更新が無く、復帰に使えない。
2. **実行手順**:
   - phase_marker 更新トリガを列挙する (session 開始 / phase 遷移 / session 終端)。
   - 各トリガで誰が更新するか (agent self-report or hook) を定義する。
   - `update-config` skill で Stop hook に phase_marker 更新呼び出しを足す提案を書く。
   - phase_marker ノードに `updated_at / updated_by / next_checkpoint` 属性を追加。
   - 今夜の状態を手で正しい値に戻す。
   - 次 session で hook が動くか検証する。
3. **判断点**: hook に API call を入れるか script 起動か / 手動更新も許容するか。
4. **議論の場**: `update-config` skill 案 + live。
5. **コスト**: S。
6. **前提**: 無し。

## §2.2 port_log の二重化

1. **問題再定義**: port_log が top-level と scope 9 に並立し、書き出し先が迷子になる。
2. **実行手順**:
   - 両所の全エントリを dump し diff を取る。
   - canonical を 1 箇所に決める (推奨: top-level、scope 9 は view)。
   - 重複エントリを merge script で統合する。
   - 旧場所を alias 化するか廃止する (§1.4 の結論に従う)。
   - sub-agent プロンプトの port_log 書き込み先を 1 箇所に固定する。
   - backlog/DECISIONS.md に「port_log canonical = X」を記録。
3. **判断点**: canonical をどちらにするか / 既存 alias をどう扱うか。
4. **議論の場**: live 即決で良い。
5. **コスト**: S。
6. **前提**: §1.4 alias SSOT が最低限動いていること。

## §2.3 quick_access 未運用

1. **問題再定義**: 次 session 開始地点のメモ場所が map より txt の方が書きやすく、map 側が空運用になっている。
2. **実行手順**:
   - quick_access ノードに書くべき情報を 3 項目に絞る (next_step / blocker / last_touched_file)。
   - 書き込み UX を見直す (viewer から 1 キー入力で編集できるか)。
   - session 終端で quick_access を自動 sync する hook 案を検討。
   - timeline.md に書いた内容を quick_access に bridge する script を書く。
   - 1 週間運用して効果測定。
3. **判断点**: quick_access を廃止して timeline.md 一本化するか / 両立させるか。
4. **議論の場**: live 1 回で決定可。
5. **コスト**: S。
6. **前提**: §1.12 TXT_MAP_SPLIT 規約。

## §2.4 port_log カテゴリ運用曖昧

1. **問題再定義**: 6 種カテゴリの判別基準が曖昧で sub-agent が全て `scope_pain` に倒す。
2. **実行手順**:
   - 6 種の定義を例文付きで書き直す (`backlog/PORT_LOG_CATEGORIES.md`)。
   - 各カテゴリに 3 例ずつ past entry を当てはめる。
   - sub-agent プロンプトに判別 flowchart を埋める。
   - 既存 `scope_pain` 集中エントリを再分類する (sub-agent 委譲可)。
   - 1 週後に再集計して分布が改善したか検証。
3. **判断点**: 6 種を維持するか統廃合するか (例: decision と open_question を分けるか)。
4. **議論の場**: `backlog/PORT_LOG_CATEGORIES.md` 起案。
5. **コスト**: S。
6. **前提**: 無し。

## §2.5 Rapid → Deep 昇格の発生記録なし

1. **問題再定義**: 昇格イベントが記録されず、Phase 遷移の実証材料が失われる。
2. **実行手順**:
   - 昇格イベントの schema を決める (from_node / to_node / timestamp / reason)。
   - port_log カテゴリに `promotion` を追加 (§2.4 と合わせる)。
   - 過去の昇格を思い出せる範囲で backfill する。
   - ノード移動 API に promotion flag option を足す (M3E 本体修正)。
   - sub-agent プロンプトで「ノード昇格時は必ず port_log に promotion を書く」を規約化。
3. **判断点**: 昇格を手動記録 vs API 自動検出どちらか。
4. **議論の場**: live。
5. **コスト**: S〜M。
6. **前提**: §2.4 カテゴリ整備。

## §2.6 決定の Why が link 先に書かれない

1. **問題再定義**: decision ノードに what だけで why/how_to_apply が無く、再利用不能。
2. **実行手順**:
   - decision ノード schema に `rule / why / how_to_apply / rejected_alternatives` を必須化する。
   - memory の feedback format を参照してテンプレを合わせる。
   - 既存 decision ノード (scalar_type_decision など) を audit し欠落を埋める。
   - sub-agent プロンプトテンプレに decision 用テンプレを埋める。
   - lint で必須欄空の decision を検出する。
3. **判断点**: 必須化の強度 (hard block / warning) / 既存 node backfill の優先度。
4. **議論の場**: `backlog/NODE_FORMAT.md` (§1.1 と統合)。
5. **コスト**: M。
6. **前提**: §1.1 NODE_FORMAT。

## §2.7 design discussion がマップに入らない

1. **問題再定義**: 反省会・設計議論が txt にすら残らず消える。本 md がその初記録。
2. **実行手順**:
   - discussion 捕捉の流れを定義する (live → txt dump → 要点 map 抽出)。
   - `backlog/discussions/` ディレクトリを切る。
   - 議論開始時の template を作る (agenda / participants / decisions / open)。
   - 議論終了時に要点を map の decision ノード or concept ノードに抽出する skill を設計する (`capture-discussion` 案)。
   - 今夜の反省会を遡及で `backlog/discussions/2026-04-16.md` に記録する。
   - map 側に「本 md から抽出」link を張る。
3. **判断点**: skill 化するか手運用か / 抽出は人間か agent か。
4. **議論の場**: live。
5. **コスト**: M。
6. **前提**: §1.12 TXT_MAP_SPLIT。

## §2.8 negative decision 未記録

1. **問題再定義**: 却下案の理由が時間で消え、再検討時に思い出せない。
2. **実行手順**:
   - decision node schema に `rejected_alternatives: [{name, why_rejected, revisit_condition}]` を必須化する (§2.6 と統合)。
   - 今夜確認できた 5 件 (Symbolics.jl / TensorOperations.jl / quasi-Hopf / MATLAB golden / OffsetArrays) を backfill する。
   - 過去 session ログを grep して skip / 却下 / 見送り の文字列を拾う。
   - 拾った候補を 1 件ずつ decision node に紐付ける。
   - sub-agent プロンプトに「却下理由も書け」を明記する。
3. **判断点**: revisit_condition を必須化するか / 却下 vs 先送りの区別。
4. **議論の場**: `NODE_FORMAT.md` に統合。
5. **コスト**: M。
6. **前提**: §2.6 と同じ schema。

## §2.9 メタ観察と実装観察の混在

1. **問題再定義**: port_log に meta / implementation / domain が混在し後で分離困難。
2. **実行手順**:
   - port_log entry schema に `layer: meta | implementation | domain` を必須追加。
   - 既存 entry を 3 層に手分類する (sub-agent 委譲可、ただし sample で誤分類率検証)。
   - sub-agent プロンプトに判別例を埋める。
   - layer 別 view を viewer に追加 (filter)。
   - layer 分布を weekly に集計して偏りを観測。
3. **判断点**: 3 層で足りるか / 1 entry が複数 layer を持つ場合の扱い。
4. **議論の場**: `PORT_LOG_CATEGORIES.md` (§2.4) と統合。
5. **コスト**: S〜M。
6. **前提**: §2.4 カテゴリ整備。

## §2.10 facet 12 progress が今夜の進捗を記録していない

1. **問題再定義**: agent が完了時に progress ノードを update する契約が無く、自動で動かない。
2. **実行手順**:
   - agent self-report contract を定義する (終了時に `{added_nodes, added_links, duration_ms, phase_delta}` を出す)。
   - m3e-map / devM3E / setrole skill の SKILL.md に self-report 必須を追記。
   - progress ノードに agent report を受ける schema を定義。
   - 今夜の Hopf one-shot を遡及で progress に backfill する (手で 1 エントリ)。
   - 次 session で自動更新が動くか検証する。
   - 未報告 agent を検出する lint を書く。
3. **判断点**: self-report の粒度 (全 agent 必須 vs 長時間のみ) / report 先 (progress node 直書き vs port_log 経由)。
4. **議論の場**: `canvas-protocol` skill の改訂 + live。
5. **コスト**: S〜M、§1.14 progress dashboard の前提。
6. **前提**: §1.12 TXT_MAP_SPLIT（report を map に入れる合意）。

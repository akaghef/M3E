---
project: AlgLibMove
date: 2026-04-16
topic: M3E dogfood 反省と今後の発展 — 網羅ダンプ
status: draft (推敲前)
purpose: 今夜 (Julia Hopf/HD 実装 one-shot 完走後) の反省会で出た論点を漏らさず記録
related:
  - plan.md
  - debt_register.md
  - codex_review_request_hopf_hd.md
  - timeline_2026-04-15.md
---

# 前提: この反省が出てきた文脈

2026-04-15 〜 2026-04-16 の 2 セッションで以下を実施:

- Phase A: 12 facets に AkaghefAlgebra MATLAB 実装を ingest (~700 nodes)
- Phase B: debt_register (26 項目 7 軸), scalar_type_decision, open_problems 7 件
- Phase C.0-a: julia_skeleton.md + migration_strategy.md
- Phase D-1〜D-5: Julia baseline 169 tests green
- Phase D-6 (今夜 one-shot): Sweedler / CGA / Taft + HD + verify 21 tests 追加、190/190 green

今夜の one-shot は sub-agent が **M3E マップを一切参照せず**に Julia を書き、verify まで通した。この事実が多数の反省を噴出させた。

---

# 0. 根源認識（以下の全反省を貫くテーマ）

## 0.1 マップの役割が authoring / record の二項対立のまま未分離

昨日までは「マップを使って設計する」(authoring)。今夜は「コードを書いてマップに記録する」(record)。両モードが同じマップ構造に同居し、どちらにも最適化されていない。

## 0.2 M3E はデータ層は揃っているが認知補助層が欠落

tree + link + attribute は動く。しかし viewer model, view mode, projection, folding rule, visual decoration, progress aggregation 等、**データを人間の認知に合わせて加工する層**が無い。MVP が「書ける・読める・リンクできる」で止まり、「考えられる・振り返れる・俯瞰できる」に届いていない。

## 0.3 AlgLibMove の実態は M3E 機能発掘 PJ

plan.md は「AkaghefAlgebra 移植の副産物として M3E 機能要求が出る」と書いた。実態は逆で、**M3E を実験する PJ として AkaghefAlgebra を使っている**。主産物は M3E への 15 件以上の機能要求。AkaghefAlgebra の Julia 移植は test bed。

## 0.4 仮説の崩壊

plan.md の「Phase A→B→C→D 直列」「世界モデル=主成果物」は今夜の D-first one-shot で崩れた。sub-agent が map 無視で green に到達した事実は、**マップは実装の前提ではなく、実装後の結晶化装置**という可能性を示す。plan.md 未更新のまま。

---

# 1. マップ構造 / 情報設計の反省

## 1.1 ラベルのみ症候群（description 欠落）

**症状**: ノードの name だけが書かれ、description / body が空。親ノードの名前から意味を推測する運用になっている。

**具体例**:
- facet 1 の `VectAlg/methods/operator/plus` はラベルだけ、「何を plus するのか、どう overload しているか」が書かれていない
- facet 5 の concept ノード `Hopf algebra` は axioms フィールドがあるのに埋まっていないものが混在

**原因**: sub-agent プロンプトに「最低限 name + description(1-3行) + source(file:line)」を書かなかった。

## 1.2 垂直入れ子過剰

**症状**: 1 subtree 内で depth 4-5 層。1 画面に method 一覧が出ない。

**具体例**:
```
VectAlg
  └ methods/
      └ operator/
          └ plus
              └ (詳細属性)
```
`methods/` と `operator/` は情報を持たない中間ノード。VectAlg の 40 method を見るために全部展開が必要。

**本来**: depth 2、中間グルーピングは tag 属性で表現。

```
VectAlg
├ plus         [tag: operator]
├ mtimes       [tag: operator]
├ Delta        [tag: math]
├ counit       [tag: math]
├ ... (40 個平積み)
```

tag ならば `verify 系` / `display 系` など別軸のグルーピングと並立できる。tree 構造は 1 軸に commit してしまう。

## 1.3 link 種別の過剰増殖

**現状使われている link 種別**: `realizes`, `uses_class`, `calls`, `follows`, `branches`, `returns_into`, `inherits`, `mixes_in`, `instance_of`, `isa_check`, `builtin`, `notation_of`, `represents`, `calls_function`, `contains`, `affects`… 15 種以上。

**問題**:
- sub-agent が使い分けられず、全部 `realizes` に倒すか、勝手に新種を作る
- 方向性規約が曖昧 (`A realizes B` は A→B か B→A か、facet によって揺れた)
- inverse link が自動生成されない、手動で双方向張りしている

**必要**: link 種別を定義ノード化 (domain / range / inverse / transitive 性質を明示)。10 種以内に統廃合。

## 1.4 alias の曖昧運用（SSOT 未達）

**期待**: ある事実は 1 箇所にのみ canonical に存在、他は alias。
**実態**:
- 参照用 alias と集約用 alias を混在
- 編集時の挙動が不明（alias 編集で canonical 変わるのか）
- canonical が削除されたら alias は?
- どれが canonical か目視で判別不能

**具体例**: facet 6 の 18 aliases、facet 2 ↔ scope 1 の集約 alias。今夜 alias バグ疑い (動作不全?) で検証必要な状態。

**必要要件**:
- canonical flag の明示（UI 表示）
- 編集の原本委譲（alias 編集 → canonical 反映、canonical 変更 → 全 alias 伝播）
- 削除 guard（canonical 削除は alias を全 reassign してから）
- alias 逆引き（canonical → 全 alias を 1 アクション）

## 1.5 表による情報圧縮力未活用

**症状**: 1 事実 1 ノードの縦書きメディア化。本来 table で表現すべきものが subtree に分解されている。

**具体例**: 今夜の Hopf 規約は 1 つの表で十分:

| 代数 | 生成元 | 関係 | Δ(x) | S(x) | dim |
|---|---|---|---|---|---|
| Sweedler | g, x | g²=1, x²=0, xg=-gx | x⊗1+g⊗x | -gx | 4 |
| CGA(N) | g | gᴺ=1 | g⊗g | g⁻¹ | N |
| Taft(n,ω) | g, x | gⁿ=1, xⁿ=0, xg=ωgx | x⊗1+g⊗x | -g⁻¹x | n² |

今のマップでは 3 × 6 = 18 ノードに分散。**情報が横並びにならず比較不能**。

**必要機能**:
- `table-node`: 同形 sibling を matrix view に投影
- subtree root で schema 宣言 → 子はそれに従う
- 決定行列 / 進捗行列 / 規約一覧など、今夜だけでも 4-5 箇所が table 最適

## 1.6 装飾 / 視覚階層なし

**症状**: 全ノードが同じ見た目。重要度・状態・更新頻度が視覚的に区別できない。

**必要**:
- `importance`: 太さ / 色 / size（自動計算: link 流入数 / 更新頻度 / phase marker からの距離）
- `status`: 色（placeholder=gray, confirmed=green, contested=red, frozen=blue）
- `recency`: 更新時刻で彩度
- `completion`: 必須属性の充足率で bordered
- `hot path` (今作業中) vs `cold path` (参照のみ)

自動計算と手動タグの併用。

## 1.7 ノード粒度と Review 粒度の不一致

**症状**: マップは method/concept 単位の細粒度。Review の問い (「Taft の S 符号は Hopf 公理と整合?」) は method 跨ぎ・concept 跨ぎ・test 跨ぎの横断ビューを要求。

**結果**: レビュアーは .jl を直読みする方が速い。マップは「どこを見れば良いかの索引」止まり。

**対応**:
- review 用 projection facet を立てる（3 algebras × 5 structure maps = 15 セルの行列）
- マップから md export (`m3e export --scope=review --format=codex-review`) で Codex 依頼文を自動生成
- authoring lens と review lens は別 projection として共存

## 1.8 depth/breadth の時間軸規約未定義

**症状**: facet 3 (call_flow) / 7 (dataflow) / 12 (progress) は時系列を持つが、sub-agent ごとに:
- あるノードは breadth に時系列 (sibling に next/prev)
- 別ノードは depth に時系列 (親→子に before→after)
が mix した。

**正解規約**: depth = 時間、breadth = 並列。理由:
- tree の自然な読み順が深さ優先
- 並列は breadth（同時発生・独立経路・分岐が兄弟で並ぶ）
- 分岐 (if/branch) が分岐点ノード → 子に各枝を breadth で自然表現
- 折り畳み単位が意味を持つ（部分シーケンスの閉じた塊が subtree）

**必要**: ノード属性に `axis: temporal | taxonomic | dependency` を付与。subtree root で宣言。

## 1.9 グラフ視覚化機能欠落

**症状**: facet 3 (call_flow) / 4 (dependency) / 7 (dataflow) は本質的にグラフ。tree + link の primitive では:
- 戻り値の流れ（DAG 合流）
- 循環呼び出し（cycle）
- 並列 actor 間の相互作用

が視覚化されない。link は張ったが見えない。

**必要**:
- mermaid 自動生成 (link サブセット → graph LR / sequenceDiagram)
- subtree に視覚モード指定 (tree / flow-graph / sequence / matrix)
- swim lane 図（並列 actor × 時間軸）
- sequence 図（method 呼び出しの往復）
- DAG 図（依存関係）

これらは tree の projection として出せる。元データは tree+link のまま、表示エンジンで切替。

**影響範囲**: AlgLibMove の主要 facet 3 つ (3, 4, 7) が事実上死に体。

## 1.10 オントロジー手法未活用

**現状**: tree + typed link = 原始オントロジー相当。しかしオントロジー工学の成熟道具を全く使っていない。

**未活用項目**:
- **class / instance 分離**: `concept: Hopf algebra` と `instance: CGA(3)` が同じノード種別
- **property (link type) の定義ノード化**: `realizes` 自体を 1 ノードとして domain/range/inverse を記録
- **inverse link 自動生成**: `inherits` → `is_inherited_by` が自動で付くべき
- **taxonomy vs partonomy**: `is-a` (class hierarchy) と `part-of` (composition) を区別
- **axiom / constraint ノード**: 「全 Hopf 代数は antipode を持つ」を制約ノード化、違反検出
- **SPARQL 相当の query**: 「quasi-Hopf を継承し associator を持つ class」を問える
- **OWL-lite 推論**: `A subClassOf B` + `B subClassOf C` → `A subClassOf C` を自動補完

**PJ 適合性**: 数学概念は形式定義と階層が明確。オントロジー dogfood の最良 test bed。

## 1.11 collapse / visibility の default 方針欠落（+ viewer context）

**現状**:
- 情報を足さない → 欠落
- 情報を平置き → 認知過負荷

**中間の正解**: 「情報は捨てず取る、default 非表示、必要時展開」。ただし静的 default では俯瞰が死ぬ。

**真の正解**: visibility は **viewer × ノード × mode** の関数。

**「どうでもよさ」の定義軸**:
1. 既知度（viewer がその概念を知っているか）
2. 当面の焦点（今 viewer が取り組んでいる phase / facet）との距離
3. 抽象度レイヤ（高レベル要約 / 中間 / 低レベル詳細）
4. 役割（definition / example / proof / implementation / edge_case）
5. derivability（他ノードから導出可能か）

**View mode の例**:
- `view: teaching` — 初学者向け、定義/例を展開、proof/edge 折り畳み
- `view: research` — 既知は折り畳み、open_question / recent のみ展開
- `view: implementation` — concept 折り畳み、realization 展開
- `view: review` — 全展開
- `view: overview` — 各 subtree root だけ

**akaghef-specific の default view**（例）:

| ノード種別 | akaghef にとっての重要度 | default |
|---|---|---|
| 数学定義 (Hopf, HD, antipode) | 既知 | collapsed |
| MATLAB 実装詳細（全 method） | 参照、暗記不要 | collapsed |
| 採用規約（Kassel 流、ω 数値） | 把握必須 | expanded |
| open_problems / port_log | 現役課題 | expanded |
| Julia 実装 | 現役 | expanded |
| Sweedler/CGA/Taft 構造定数 | 計算済み | collapsed |

**実装方向**:
- viewer profile（知識状態）を M3E に登録
- ノード側の visibility rule: `collapse_if: viewer.known(topic)`
- mode switch UI（ワンクリック）

## 1.12 テキストファイルとの役割分離

**症状**: timeline / log / backlog / port_log / debt_register / open_problems の境界が曖昧。どれに何を書くか迷う → 書かない or 重複。

**原則案**（今夜の経験から）:

| 用途 | 適媒体 | 理由 |
|---|---|---|
| 時系列ログ | **txt** | append only, grep, diff, compaction 安定 |
| 議論・思考推移 | **txt** | 文脈保持、引用、行番号参照 |
| 確定事実の構造化知識 | **map** | 検索、link、重複排除 |
| 決定の根拠 + 適用範囲 | **map** | 制約付き、参照される |
| 規約 / 形式定義 | **map** | SSOT |
| 経過観察・途中の困惑 | **txt** | 流れが重要、構造化は後 |
| 結論の要約 / 整理 | **map** | 抽出結果、正規形 |

**指針**:
- 時間が主軸なら txt、関係が主軸なら map
- 書きながら考えるなら txt、整理されたら map
- 検索で辿りたいなら map、読み下したいなら txt

**相互リンク**: map 側に `log_ref: timeline_2026-04-15.md:L42` 属性。map が txt への pointer を持つ、逆は持たない。

## 1.13 スナップショット欠落

**症状**:
- Phase A.1 終了時点のマップ再現不能
- 「今日追加した 300 ノードを消したい」の undo 単位なし
- compaction 前の思考をマップから復元不能（今夜実証）
- 決定を時系列で追えない

**必要機能**:
- git-backed snapshot（マップ永続化を git として、session 終端/phase 遷移で auto commit）
- named snapshot（「Phase A 終了」「12 facets 完遂」をタグ pin）
- diff view（snapshot 間の追加/削除/変更ノードを diff）
- 時間軸スクラブ（過去任意時点を閲覧）

既に git worktree を使っているので、**マップデータを git 配下に置くだけで最低線は取れる**。していないのが怠慢。

## 1.14 プロジェクト進行度の可視化欠落

**症状**: facet 12 (progress) を作ったのに、マップ一瞥で進行度が分からない。5 ファイルを開いて目で集計している。

**必要**:
- phase meter (A/B/C/D どこに居るか、完了率)
- facet health dashboard (ノード数 / 更新時刻 / stale 判定 — データは取れている、view が無い)
- Must/Should/Nice/Future の達成バッジ
- blocker 可視化 (open_problems 件数 / debt_register 未解決 high-priority 数)
- burn-down (open_questions が時間で減っているか)

**本質**: 集計ビュー。生データは各 facet に、ROOT は agg view であるべき。現状 ROOT は「目次」止まり。

---

# 2. 運用プロセスの反省

## 2.1 ROOT の phase_marker が機能していない

**症状**: 更新忘れ頻発。翌セッション復帰に使えなかった。

**原因**: 更新タイミング規約未定 + 自動更新機構無し。

## 2.2 port_log の二重化

**症状**: top-level と scope 9 で重複。timeline 18:15 で気付いたが未解決。

**原因**: 書き出しの第 1 場所を決めなかった。

## 2.3 quick_access 未運用

**症状**: plan.md の「次セッションの開始地点を ROOT/quick_access にメモ」ルール守られず。timeline.md が事実上代替。

**原因**: map 側より txt の方が書きやすい UX。

## 2.4 port_log カテゴリ運用曖昧

**現状**: `scope_pain / format_gap / open_question / decision / tool_wish / ai_handoff` の 6 種。ほぼ全部 `scope_pain` に落ちている。

**原因**: カテゴリ定義が 1 行で、判別基準が曖昧。sub-agent が全部 scope_pain にする。

## 2.5 Rapid → Deep 昇格の発生記録なし

**症状**: どのノードがいつ昇格したか追跡不能。Phase A→B 遷移の実証材料が失われた。

**対応**: 昇格イベントを port_log に記録するルールが必要。

## 2.6 決定の Why が link 先に書かれない

**症状**: 決定ノードに「何を」だけ書かれ、「なぜ」「どう適用するか」が無い。

**対応**: memory の feedback と同じ format を要求する。`rule` / `why` / `how_to_apply` 必須フィールド化。

## 2.7 design discussion がマップに入らない

**症状**: 今夜の 5 回以上の反省会（何を実装するか・どの流儀か・scope 切りすぎ認識・depth/breadth 認識・collapse default 認識）がマップに一切反映されていない。**この反省会自体**もまだ未記録（本 md が初）。

**対応**: discussion を captured するプロセスが必要。txt に書き、重要点を map に抽出。

## 2.8 negative decision 未記録

**症状**: 「却下した案」が消える。
- Symbolics.jl skip
- TensorOperations.jl skip
- quasi-Hopf skip
- MATLAB golden 後回し
- OffsetArrays 却下

**理由**: 却下理由は時間で消える。再検討時に「なぜ skip したか」を思い出せない。

**対応**: `rejected_alternatives` 属性を decision ノードに必須化。

## 2.9 メタ観察と実装観察の混在

**症状**: port_log に:
- M3E の弱点観察（メタ）
- Hopf 代数実装の知見（実装）

が同じ pool に入って後で分離困難。

**対応**: `layer: meta | implementation | domain` タグ必須化。

## 2.10 facet 12 progress が今夜の進捗を記録していない

**症状**: progress facet を作ったのに自動では動かない。sub-agent が進捗を書き戻さない。

**対応**: agent 完了時に progress ノードを必ず update する contract を skill / prompt に埋める。

---

# 3. sub-agent 運用の反省

## 3.1 format 規範がプロンプトに無い

**症状**: sub-agent は「ノード作れ」と言われるとラベルだけ作る。「親ノード名から推測可能」と判断する。コスト最小化バイアス。

**対応**: `m3e-map` skill に各ノード種別のテンプレ例を埋める。

## 3.2 粒度規範がプロンプトに無い

**症状**: 「method は全部ノード化」しか言わず、内部構造の展開度が未指定。結果、sub-agent ごとに粒度揺れ。

## 3.3 axis 規範がプロンプトに無い

**症状**: §1.8 既出。temporal/taxonomic/dependency を sub-agent に明示していない。

## 3.4 並列 sub-agent 間の link 衝突

**症状**: facet 跨ぎ link は manager が serial 処理。しかし同一 facet 内並列書き込みでも POST race が 1 件発生し、重複ノード。

**対応**: sub-agent の書き込み範囲を subtree 単位で排他、または楽観的ロック。

## 3.5 partial output 活用なし

**症状**: 失敗 / 中断した agent の部分成果を拾う仕組み無し。

## 3.6 agent の self-report 未要求

**症状**: 実行後にマップ状態を manager が確認する非対称運用。agent 側で「何ノード追加、何 link 追加」を自己報告すべき。

---

# 4. 会話・意思決定の反省

## 4.1 A→B→C→D 仮説が D-first で崩壊

**発見**: 今夜の one-shot で sub-agent がマップ無視 + MATLAB 参照最小 + 世界モデル抽出なしで verify green まで到達。

**示唆**: 「理解 → 設計 → 実装」直列の前提が、少なくとも数学的に well-documented な領域では成立しない。LLM は文献知識から直接実装できる。

**対応**:
- plan.md 更新必須（古い仮説で動く次の読者を誤導する）
- Phase の意味を再定義: A = 理解のため vs A = 記録のため
- 「書いてから整理」パスの正式化

## 4.2 世界モデル=主成果物の前提も再考

**事実**: 今夜の主成果は Julia コード、世界モデルは副産物だった。

**仮説更新案**:
- 世界モデル = 主成果物 (plan.md の元の主張) は**再利用性前提**なら正しい（論文・教育・他言語移植）
- しかし本 PJ の短期 value は Julia コード
- **世界モデルは implementation の成功後に harvest される**（before ではなく after）

## 4.3 dogfood 報告自体が非構造

**症状**: 今夜の気付きを port_log に入れるにも、分類軸が弱い。「M3E 機能要求 / 運用規範 / PJ 固有学び」の 3 分類すら未確立。

**対応**: 本 md がその構造案。port_log 投入時は同じ分類を使う。

---

# 5. ツール / 環境の反省

## 5.1 timeline 手書き消耗

**症状**: 今夜の timeline_2026-04-15.md は ~1 時間手書き。

**対応**: agent の duration_ms を食わせて machine-generated できる。auto-timeline tool が欲しい。

## 5.2 compaction 耐性ゼロ

**症状**: 今夜 1 回 compaction で pre-phase の詳細時刻が失われた。

**対応**: マップに中間スナップショット（§1.13）+ session summary を session 終端に必ず出力。

## 5.3 rm 権限拒否の摩擦複数回

**対応**: settings 未整備。update-config skill で解消可能。

## 5.4 session_metrics / timeline / port_log / debt_register の境界曖昧

**症状**: どれに何を書くか迷う → 書かない or 重複（§2.2）。

**対応**: §1.12 の txt / map 分離原則を具体ファイルに適用。

## 5.5 GitHub 運用ルール未整備

**症状**:
- `prj/AlgLibMove` branch で切ったが PR / commit / tag 規約未定
- 今夜の Julia 190 green も commit していない
- `backlog/*.md` / `julia/src/Hopf/*.jl` 追加は untracked のまま再起動でロストリスク
- dev-beta 本流への merge 戦略未定（戻す / 別リポ / `julia/` だけ extract?）

**対応**: 最低限 `<phase>: <何>` 形式 commit message、実装区切りで commit、phase 終端で tag、を規約化。

## 5.6 ショートカット質問トリガーなし

**症状**: マップの気になるノードについて Claude に訊く操作が:
1. ノードのパスをコピー
2. チャットに貼り付け
3. 「説明して」と書く
4. Claude がマップを読みに行く
の 4 ステップ。発想の流れが切れる。

**必要 UX**:
- マップのノード上で hotkey 1 つ (例: `?`)
- 定型問い menu（説明 / 不足情報 / 親概念との関係 / 実装先）
- 選択 → 自動で Claude に送信、関連 context 付き
- 回答はノードの子にアタッチ or ポップアウト
- ノード attribute の「質問テンプレ」を subtree root が定義可能

**影響**: マップが対話の起点になる。現状は記録場所止まり、「考える相棒」になっていない。

---

# 6. M3E 本体への機能要求サマリ（優先順）

## 6.1 最優先（マップの健全性 / 即時リスク）

1. **alias バグ検証** — 機能不全なら既存マップ構造崩壊、最初にやるべき
2. **視覚階層 / 装飾** — importance / status / recency / completion
3. **viewer-context 依存の collapse** — akaghef 向け default view の定義

## 6.2 高優先（認知補助層の骨格）

4. **グラフ視覚化** (mermaid / swim lane / sequence / DAG)
5. **table-node / projection**
6. **progress dashboard**（ROOT に集計ビュー自動生成）
7. **shortcut query trigger**（ノード→ Claude 問い合わせ 1 ステップ）

## 6.3 中優先（オントロジー層）

8. **alias SSOT 強化**（canonical / 委譲 / guard / 逆引き）
9. **class / instance 分離**
10. **inverse link 自動生成**
11. **axiom / constraint ノード + 違反検出**
12. **SPARQL 相当の query 言語**
13. **link 種別の定義ノード化**（domain/range/inverse/transitive）

## 6.4 中優先（snapshot / 時間軸）

14. **git-backed snapshot**（auto commit on session/phase）
15. **named snapshot + diff + time scrub**

## 6.5 運用改善

16. **txt / map 役割分離の運用規約 + `log_ref` pointer**
17. **auto-timeline from agent duration_ms**
18. **agent self-report contract**（追加ノード/link 数を必須報告）
19. **m3e-map skill への format テンプレ埋め込み**
20. **PJ ごとの `NODE_FORMAT.md` 規範**
21. **prompt template library**（ingest / concept 抽出 / 規約記録 / port_log harvest）

---

# 7. AlgLibMove PJ 個別の宿題

## 7.1 今夜の Julia 実装の後始末

- [ ] 190 green state を commit（§5.5 の規約決めてから）
- [ ] Codex review 結果の取り込み（[backlog/codex_review_request_hopf_hd.md](backlog/codex_review_request_hopf_hd.md)）
- [ ] 採用規約（Kassel 流、ω 数値、HD 積公式）を facet 11 に記録
- [ ] 今夜の Hopf/HD 実装を facet 5 concept に `realizes` link で接続
- [ ] `@calcTE` マクロの実装詳細を facet 7 (dataflow) に反映

## 7.2 MATLAB golden との数値一致 gate

- [ ] MATLAB 実行環境整備 (Octave 代替検証含む)
- [ ] 構造定数 dump の format 決定
- [ ] parity test framework を `julia/test/parity/` に整備
- [ ] 3 algebras × 構造マップ 5 個 = 15 セルの golden 一致マトリクス

## 7.3 残 method 実装

- [ ] Integrals (left/right/two-sided) — facet 10 verify 系
- [ ] rep (行列表現) — Heisenberg double の研究利用入口
- [ ] act (action on H*) — Kashaev embedding の前段
- [ ] canonical elements G, W, W⁻¹

## 7.4 世界モデルの backfill

- [ ] 今夜の Julia 実装から得た知見を facet 5 に戻す
- [ ] 特に HD の積公式の選択 (f⊗h)(g⊗k) = f(h₁▶g)⊗h₂k と MATLAB VectHeisenbergDouble.setConst の規約差分を明示
- [ ] dual pairing の定義の選択肢（dual basis vs natural pairing）を concept 化

## 7.5 マップ健全性回復

- [ ] alias バグ検証（§6.1-1）— 最初にやる
- [ ] 既存 facet の depth を平坦化（§1.2）
- [ ] 中間グルーピングノードを tag 属性に降格
- [ ] link 種別を 10 以内に統廃合
- [ ] audience / view mode 属性を既存ノードに backfill

## 7.6 plan.md の更新

- [ ] 「A→B→C→D 直列」仮説を「D-first also valid for well-documented domains」に更新
- [ ] 「世界モデル = 主成果物」を「primary deliverable conditional on reuse intent」に更新
- [ ] Phase 移行条件を現実に合わせる
- [ ] 今夜の dogfood 発見を appendix に追記

---

# 8. 今すぐやる vs 後回し

## 8.1 今夜中（低コスト高 value）

- 本 md を書き終える（進行中）
- git commit（最低限の規約だけ決めて）
- alias バグの再現 1 件だけ試す

## 8.2 明日午前

- alias バグ本調査
- 本 md の §6 を port_log に投入（個別エントリ化）
- plan.md の仮説更新
- facet 11 への規約記録（今夜の 7 規約）

## 8.3 今週

- マップの平坦化 refactor
- link 種別統廃合
- MATLAB golden 一致 gate の環境整備
- `m3e-map` skill への format テンプレ埋め込み

## 8.4 中期（M3E 本体開発）

- §6.2 〜 §6.3 の認知補助層とオントロジー層の実装計画
- これは別 PJ `feat/m3e-cognition-layer` として dev-beta で進めるべき

---

# 9. 本 md 自体についてのメタ

- 本 md は**推敲前のダンプ**。網羅優先で重複・冗長含む
- 記述順は論点の発露順を尊重、完全な分類整理ではない
- 次のステップは:
  - 本 md を port_log にエントリ化（1 論点 1 ノード、本 md を `log_ref` として参照）
  - §6 の機能要求を M3E 本体の feature tracker に投入
  - §7 の PJ 宿題を Todo_Pool に投入
- **本 md 執筆自体がメタ dogfood**: 反省を構造化できないと、反省を活かせない。その場を txt が担い、map に抽出する運用 (§1.12) の実践

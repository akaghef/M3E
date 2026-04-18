# 07. M3E との接続候補と未決質問

02〜06 で並べたサービス群を、M3E 側からどう使うか / どう繋ぐか を俯瞰する。
**実装判断はしない**。接続パターンと優先順、未決質問のみ。

## M3E 側のユースケース（接続の動機）

- **U1. 概念ノードに外部 ID を付与** — 「フェルマーの小定理」ノードに Lean4 宣言名、OEIS 参照、MSC コード、Wikidata QID を属性で持たせる
- **U2. 研究トピックノード → 関連論文自動取込** — zbMATH / arXiv / OpenAlex からノードに子として文献リスト
- **U3. 論文執筆ドラフト生成（B1 連動）** — 引用が外部 DB の DOI で自動フォーマット、MSC 自動タグ
- **U4. 科研費申請支援（B2 連動, project_projection_vision）** — researchmap + KAKEN + arXiv から業績と関連分野を自動編成
- **U5. 形式化の下書き** — 自然言語ノード → AI で Lean ステートメント生成（自動形式化）
- **U6. 重複検出（D1）への意味的強化** — Wikidata QID 一致 / OpenMath CD 一致でノード重複を検出
- **U7. AI エージェント（C5 insight 抽出）への意味文脈供給** — 分野コードや関連定理を LLM プロンプトに埋込
- **U8. 日本語数学オントロジー構築** — 既存国際サービスに日本語ラベルを M3E 側で付けて共有

## 接続パターン

### P1. 外部 ID 属性化
- ノードの `meta` に `wikidata_qid`, `msc`, `lean4`, `oeis`, `doi`, `arxiv` フィールド
- 表示時に自動リンクアウト
- 取込は手動付与 + AI 推測

### P2. プル型ウィジェット
- 特定ノードを開いた時に zbMATH / arXiv API を叩いて関連論文を side panel 表示
- 取込ボタンで子ノード化

### P3. ダンプ取込
- OpenAlex snapshot, MSC SKOS, OEIS データ dump を一度ローカル DB 化
- M3E から SQLite 的に参照
- 初期コスト高だが API 制限なし

### P4. SPARQL ブリッジ
- Wikidata / MaRDI KG へクエリ送信、結果を RDF で受け取りノード化
- 長期的にオントロジー連携の本命

### P5. Lean サーバ連携
- Lean4 サーバをローカル/リモートで起動
- ノードに Lean4 statement を書いて `check` ボタンで検証
- エラー出力をノードに返す

### P6. AI 経由の橋渡し
- 外部サービスに直接接続せず、LLM に検索させて結果を取込
- 脆弱だが初期実装は最小

### P7. エクスポート型
- M3E マップを RDF / OMDoc / Wikidata 形式でエクスポート
- 外部サービスに投入する側に回る

### P8. Deep 帯域の関係線を多種エッジで育てる（帯域観で再定義）

**[訂正]** 以前「二層エッジモデル」と呼んだものは、M3E に既に存在する **edge（親子 = Rapid 骨格）** と **関係線 GraphLink（Deep の芽）** の二分を、Deep 側で多種エッジ化する話。新概念ではなく、既存構造の成長。

- **問題意識の再整理**:
  - Rapid 帯域（M3E 現状の中心）は既に成立: 親子 edge による syntax tree
  - Deep 帯域はまだ芽の段階: GraphLink（関係線）に `relationType?: string` があるだけ
  - Blueprint / Lean / Make 依存 = **Deep の「uses 1 種に痩せた形」**（[docs/01_Vision/Axes.md](../../../docs/01_Vision/Axes.md) 明記）
  - nLab / Wikidata / 研究者の頭 = **Deep の本来形**（多種エッジ）
  - M3E は Deep の本来形を目指す → GraphLink の多種化・意味付与を育てる

- **方針**:
  - **親子 edge** は Rapid の骨格として維持。変更しない
  - **GraphLink** を Deep 帯域の本格 semantic graph の媒体として育てる:
    - `relationType` を自由文字列のまま or 固定語彙化するかは未決（Q13）
    - 「一般化 / 双対 / 例 / 動機 / 類比 / 矛盾 / 先行 / uses / see_also」等を扱えるようにする
  - **外部 DAG（Blueprint / Stacks）の取込は GraphLink に入る**（relationType = "uses" で痩せた形のまま流入）
  - 層分割ではなく **同じ GraphLink の中に kind で分岐**

- **表示**:
  - Rapid 骨格（親子 edge）と Deep 関係線（GraphLink）は既存通り別スタイル
  - GraphLink 内部で kind 別の色・線種（uses = 地味、semantic = 派手 等）
  - kind フィルタ（後述 Phase）で「uses だけ」「意味関係だけ」切替

- **実装示唆**:
  - `GraphLink.relationType` を活用（既に自由文字列、型変更不要）
  - 推奨語彙を別途定義（語彙ファイル / Glossary 追記）
  - 既存 `style` は表示ヒント用として共存

- **体系化 / 射影との接続**:
  - **体系化** (Rapid → Deep): Rapid 文書群の親子 tree から、概念レベルの関係線を引き出して Deep に取り込む → GraphLink 多種化が前提
  - **射影** (Deep → Rapid): Deep の semantic graph から目的別の説明順序を切り出す → kind 情報を使って「引用は uses、一般化は背景、双対は対比」等のテンプレ分岐が可能
  - project_projection_vision の科研費出力はこの射影の応用

- **M3E の位置取り**:
  - L1 外部系（Blueprint 等）= uses 単エッジの痩せた Deep
  - L2 外部系（nLab 等）= 意味を自然言語で書いただけの Deep
  - L3 OWL/SKOS = 意味を形式化できるが UX 硬い
  - **M3E = 個人研究者の手元で Deep を編集・可視化し、Rapid へ射影する環境**。この隙間に立つ

## 優先順位の見立て（推しだが決定ではない）

| 優先 | 接続候補 | 理由 |
|---|---|---|
| ⭐⭐⭐ | S11 arXiv + S8 OpenAlex + S1 MSC | 研究者の日常最頻、API 整備良、無料 |
| ⭐⭐⭐ | S15 researchmap + S16 KAKEN | project_projection_vision の直接経路 |
| ⭐⭐⭐ | S6 Wikidata 数学サブグラフ | CC0 + SPARQL、ハブ戦略の中心 |
| ⭐⭐ | K1 OEIS | 数列研究者に高価値、API シンプル |
| ⭐⭐ | K14 Stacks Project | 代数幾何の DAG、tag 参照 |
| ⭐⭐ | A3 mathlib4 Blueprints | 思想近い、接続で学べる |
| ⭐⭐ | B1 Lean4 / mathlib4 | 形式化トレンドの中心 |
| ⭐ | K5 nLab / K6 ProofWiki | コミュニティ wiki、CC-BY-SA 取込可 |
| ⭐ | S2 zbMATH Open | 書誌の国際標準 |
| ⭐ | L3 (OpenMath/OMDoc) | 内部表現検討時に参考 |

## 組み合わせ高効果ペア

- **⭐ P8 Deep 関係線育成 × A3 Blueprint × K5 nLab**: Blueprint の痩せた Deep（uses のみ）と nLab の多種意味 Deep を同じ GraphLink 層に流入させ、kind で区別。体系化の素材として両方を活かす
- **S11 arXiv × S1 MSC × S8 OpenAlex**: 論文 → 分野コード → 引用グラフの三点セット
- **S15 researchmap × S16 KAKEN × S11 arXiv**: 日本研究者のフルプロファイル
- **A3 Blueprint × B1 Lean4 × M3E**: 自然言語 blueprint を M3E で書いて Lean に落とす流れ（**ただし Blueprint は syntax 層のみ、semantic は別途 M3E で付与する前提**）
- **K1 OEIS × S6 Wikidata**: 数列 ↔ 概念のハブ連結
- **A29 自動形式化 × B1 Lean4 × L5 privacy**: ローカル LLM で形式化、外部に出さない安全経路
- **S5 MaRDI KG × M3E**: 相互参照で両方の知識グラフを拡張し合う
- **F16 SKOS × F17 OWL × P8 semantic 層**: semantic エッジの種別語彙を SKOS/OWL から借用（car を一から作らない）

## 未決質問

- **Q1.** M3E は「独自ハブ」になるのか、「Wikidata/MaRDI のクライアント」なのか
- **Q2.** ノードの外部 ID は 1 対 1（canonical）か多対多（複数リンク許容）か
- **Q3.** 取込時のライセンス遵守を M3E 側が保証する仕組み（CC-BY-SA の継承表示など）
- **Q4.** 外部サービス API の停止・仕様変更への耐性設計
- **Q5.** 日本語ラベル付与の主体は誰か（AI / ユーザー手動 / コミュニティ）
- **Q6.** AI 経由取込（P6）の「幻覚リスク」をどう管理するか
- **Q7.** 形式検証（P5 Lean サーバ）は必須機能か、プラグインか
- **Q8.** 科研費申請用のテンプレ（B2）は、この外部データから自動生成できるか、人手必須か
- **Q9.** 研究者が使う既存ツール（Obsidian + Zotero）との棲み分け
- **Q10.** Stacks Project や Blueprint を「M3E ビューで閲覧」する機能は、本家からの差別化になるか
- **Q11.** L5 AI モデルの更新スピードに M3E は追随するか、安定版固定か
- **Q12.** Wikidata に M3E 側から **書き込む**（数学オントロジー貢献）という逆方向フロー
- **Q13.** semantic エッジの **種別語彙（kind）** をどう決めるか
  - 選択肢 a: SKOS 準拠（broader/narrower/related の 3 種のみ、簡素）
  - 選択肢 b: OWL 自由定義（完全カスタム、複雑）
  - 選択肢 c: M3E 独自の固定 10 種（generalizes / dual / example / motivates / analogous / contradicts / precedes / used_by / defined_by / see_also など）
  - 選択肢 d: 自由文字列（型なし）＋ AI に自動分類させる
- **Q14.** syntax 層と semantic 層を **同時に表示** するか、**切替** にするか（情報量と混乱のトレードオフ）
- **Q15.** 既存の M3E ノードリンクを後付けで二層化するマイグレーション戦略（全既存エッジは `syntactic` か `semantic` か、あるいは `unlabeled`？）

## 最小接続仮案（あくまで見立て）

もしどれか一つだけ試すなら、という最小構成:

- **Step A**: ノード meta に `external_refs: {wikidata?, arxiv?, doi?, msc?}` を追加
- **Step B**: 既存 AI subagent に「このノード内容で Wikidata と arXiv を検索して候補を返す」tool を追加
- **Step C**: 候補をノード属性に採用ボタンで固定
- **Step D**: 表示時にリンクアウト

これだけで U1（ID 付与）+ U2（関連論文）の入口が開く。
他の接続（Lean / MSC / 科研費）は Step B を拡張する形で順次。

## 横断観察（ブレスト末尾の気づき）

1. **「数学 × オントロジー」は既に膨大な先行サービス** があり、M3E が 0 から作るのは無謀
2. しかし **互いに統合されていない** のが現状 → M3E の価値は「個人研究者の手元で統合する薄いハブ」
3. **日本語化** は巨大な未開拓領域 — 国際サービスのほぼ全てが英語中心
4. **science の RDF / FAIR 化** は MaRDI が先頭、追随するか独自路線か
5. **AI × 形式数学** は 2026 現在活発だが、M3E は「LLM に触れさせる知識の構造化」に徹するのが吸収されない生き残り方
6. **project_projection_vision の科研費出力** との最短経路は L4（書誌）→ researchmap + KAKEN ルート
7. **世界モデル側** の素材は L2 知識ベース（OEIS, nLab, Stacks）が最も豊富
8. **M3E は Blueprint × Wikidata × 研究者ノート** の三点を繋ぐ位置取りが面白い
9. **帯域軸との整合が本ブレスト最重要の観点**（[Axes.md](../../../docs/01_Vision/Axes.md)）
   - Rapid = 文書 1 の syntax tree（親子 edge）
   - Deep = 文書群の semantic graph（多種エッジの関係線）
   - Blueprint / Lean / Make 依存は **Deep の「uses 1 種に痩せた形」**。Rapid ではない
   - M3E は Deep の本来形（多種エッジ）を目指す位置取り
10. **M3E に二層は既に存在する** — 新しく作る必要はなく育てる話
    - **edge**（親子）= Rapid 骨格、維持
    - **GraphLink（関係線）** = Deep の芽、多種化で育成
    - P8 はこの既存二分の Deep 側（GraphLink）に意味種別を与える実装
11. **本ブレストの価値の焦点**: Deep 帯域の素材供給源（nLab / Stacks / Wikidata / Blueprint）を体系化の材料に、射影で科研費等の Rapid 出力を生成する project_projection_vision の地ならし

# AI / エージェント深化 — 思考パートナーとしての AI

既存 `ai_subagent.ts` / `ai_infra.ts` は「topic 提案」「linear-transform」レベルに留まっている。
本ブレストは、それを超えて **M3E を「思考パートナー」化する** ための AI 機能候補を網羅する。

研究者の脇にいて、反論し、質問を返し、夜の間にマップを掃除し、
気づきを差し出す存在 — その人格設計と技術選択肢のプール。

## 方針

- **採否は決めない**。10 候補すべてを並列に並べる
- **実装詳細は決めない**。MVP ファイルだけ最小スケッチを置く
- **Pattern B**（候補列挙＋共通基盤）採用。10 サブトピックがあるため、
  グループ化（壁打ち系 / 検索系 / 自走系 など）して 4 ファイルに分散
- **既存ブレストと cross-link**：`automation_obstacles/` の P3（壁打ち）/ P5（検証スキャフォールド）/ P10（レイヤ分離）と
  N1〜N15（自動化しない領域）に必ず触れる
- **AI ベンダ切替**（Claude / GPT / local LLM）の論点は横断的に扱う
- **プライバシー検閲**（L5）は前提条件として全候補で考慮

## ファイル構成

- [README.md](README.md) — 本索引、論点一覧、cross-link
- [01_global_design.md](01_global_design.md) — 共通論点（人格モデル・自動化レベル・送信前検閲・ベンダ切替）
- [02_sparring_agents.md](02_sparring_agents.md) — C1/C2/C3/C9（反論・質問・多視点・ペルソナ）
- [03_map_hygiene_insight.md](03_map_hygiene_insight.md) — C4/C5/C7/C10（リンク提案・insight・要約階層・自走 AI）
- [04_research_query.md](04_research_query.md) — C6/C8（research assistant・会話型クエリ）
- [05_mvp_and_open_questions.md](05_mvp_and_open_questions.md) — 横断観察・MVP 候補・未決質問

## 全体俯瞰 / 論点マップ

10 個のサブトピックを「AI が誰の役を演じるか」で 3 軸に分類:

| 軸 | サブトピック | 主な役割 | 自動化レベル目安 |
|----|------------|---------|---------------|
| 壁打ち（Sparring） | C1 / C2 / C3 / C9 | 質問・反論・視点提供 | L1〜L2（提案のみ） |
| 衛生・気づき（Hygiene/Insight） | C4 / C5 / C7 / C10 | リンク・insight・要約・自走整理 | L1〜L4（夜間自走あり） |
| 検索・取り込み（Research/Query） | C6 / C8 | 文献投入・会話型検索 | L1〜L2（人間最終判断） |

L0〜L4 の自動化レベルは `automation_obstacles/02_solution_patterns.md` P2 を踏襲。

## 論点一覧

主要論点 ID を README に集約。詳細は各ファイル参照。

### G. 共通基盤（01_global_design.md）
- G1. AI 人格モデル — 1 体の汎用 vs 複数ペルソナ vs 動的人格
- G2. 自動化レベル設計 — どの機能を L1〜L4 のどこに置くか
- G3. 送信前検閲（L5） — クライアント側で機微情報を弾く層
- G4. ベンダ切替アーキテクチャ — Claude / GPT / local の使い分け
- G5. コスト管理 — token 課金、batch 化、cache 戦略
- G6. 出力検証スキャフォールド — P5 適用、確信度表示、出典必須
- G7. プロンプト資産化 — P4 適用、マップ内プロンプトノード
- G8. アンドゥ徹底（P15） — AI による変更は必ず 1 キーで戻せる
- G9. 「やらない」基準 — N1〜N15 をどう運用に落とすか
- G10. AI 出力の痕跡保存（P9） — どの AI が・いつ・何を出したかをノード属性化

### S. 壁打ち系（02_sparring_agents.md）
- S1. Devil's Advocate（C1）の発火タイミング — 手動 vs 自動 vs 閾値
- S2. 反論の深さ — 1 行コメント vs 多段論証
- S3. 質問生成器（C2）の問い方 — Socratic / Five Whys / SCAMPER
- S4. 多視点（C3）の視点リスト — 固定セット vs ユーザ定義
- S5. ペルソナ（C9）の人格データ — 指導教員/査読者/学生/未来の自分
- S6. コメントの保存場所 — 子ノード vs メタ属性 vs 別レイヤ
- S7. 「無視する権利」 — AI コメントを表示しない設定
- S8. ペルソナ切替 UI — pill / モード / コマンドパレット

### H. 衛生・気づき系（03_map_hygiene_insight.md）
- H1. リンク提案（C4）の判定軸 — semantic / structural / temporal
- H2. リンク提案の表示 — 候補 inbox / 仮リンク / オーバーレイ
- H3. insight 抽出（C5）のスコープ — subtree / workspace / 横断
- H4. insight の保存 — daily report / 専用ノード / 通知
- H5. 要約階層（C7）の粒度 — 1 行 / 3 行 / 1 段落 / topic-list
- H6. 要約のキャッシュ戦略 — 都度生成 vs 定期再生成
- H7. 自走 AI（C10）のトリガ — cron / idle / 閾値超過
- H8. 自走 AI の権限 — read-only / proposal-only / write-with-undo
- H9. 自走 AI の事後レポート — 朝の「夜のうちにこれをしました」要約
- H10. 自走と「やらない」（N1/N7/N11）の境界

### R. 検索・取り込み系（04_research_query.md）
- R1. research assistant（C6）の情報源 — Web / arXiv / Zotero / 内部
- R2. 文献ノードのスキーマ — 引用情報・抜粋・要約・確信度
- R3. 自動投入 vs 提案 inbox — どこまで自動で書き込むか
- R4. 会話型クエリ（C8）の入力 UI — チャット欄 / コマンドパレット / 音声
- R5. クエリ結果の提示 — ノード強調 / 別ペイン / inline カード
- R6. 「先週」「○○について」の意味解釈 — 時系列・タグ・semantic
- R7. クエリ履歴の資産化 — よく聞くクエリをマップに残す
- R8. 検索 vs 生成の境界 — マップ内に答えがある時は生成しない

### M. MVP / 未決（05_mvp_and_open_questions.md）
- M1. 最小実装 3 候補 — Devil's Advocate / 自動 link 提案 / 会話型クエリ
- M2. ベンダ抽象化の最低要件
- M3. 検閲層の MVP — regex+辞書から始めるか、軽量 LLM 検閲器か
- M4. 主要な未決質問 5 件

## Cross-link

`automation_obstacles/` への参照（必ず見ること）:
- **P3 壁打ち相手**：本ブレストの C1/C2/C3/C9 すべての基本姿勢
- **P5 検証スキャフォールド**：C4/C5/C6 の出力検証で必須
- **P10 安全性によるレイヤ分離**：G3/G4 のベンダ切替で直結
- **P2 段階的自動化**：G2 の L1〜L4 設計で踏襲
- **P9 痕跡保存**：G10 の AI 出力痕跡で踏襲
- **P15 アンドゥ**：G8 で踏襲
- **P19 失敗の許容**：自走 AI の失敗ログ運用
- **N1 思考の核心**：自走 AI が触ってはいけない領域
- **N7 創発の場**：壁打ち AI が「答えを出す」べきでない領域
- **N11 創造的逸脱 / N12 下手に書く体験**：要約・補完で AI に侵食させない領域

`keyboard_modes/` への参照:
- **M27 Assign mode / M28 Q&A mode / M29 Pair-with-agent mode**：本ブレストの UI が乗る場所
- **M03 Scratch organize mode**：C10 自走 AI の出力先が scratch になる場合の整理動線

## キーメッセージ（暫定）

- 壁打ち系（C1/C2/C3/C9）は **AI に答えを出させない** 設計が肝
- 衛生系（C4/C5/C10）は **L1〜L2 から始め、信頼が貯まったら L3 へ** 進める
- 自走 AI（C10）は「夜中の小人」ではなく「朝の報告書」を出す形が安全
- ベンダ切替は **機能単位ではなくデータ機微度単位** で分けるのが現実解
- プライバシー検閲（L5）は MVP からスタブで入れる必須レイヤ

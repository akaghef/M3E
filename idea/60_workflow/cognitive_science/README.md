# 認知科学・学習科学応用（Category J）

M3E の「ノード = 知識単位」を **覚え続ける／忘れる／問い直す／メタ認知する** 学習科学的視点で展開するブレインストーミング。

研究者 akaghef のユースケース（半年で「世界モデル → 射影」実用化）を念頭に、
「自分の研究マップ自体を学び直し続ける」体験を設計する素材を並べる。

## 方針

- 採用判断はしない
- 実装詳細は決めない（最後の MVP ファイルで参考程度）
- 複数案を並べる
- M3E 既存属性（status / weight / details / scratch）と接続できる形で書く
- N5（学習）/ N4（一次接触）の「自動化してはいけない」原則と矛盾しない
  → 学習を **置き換えない** 補助具として設計する

## ファイル構成

- [README.md](README.md) — 索引と論点一覧
- [01_srs_integration.md](01_srs_integration.md) — J1: 間隔反復（SRS）統合
- [02_forgetting_curve.md](02_forgetting_curve.md) — J2: 忘却曲線可視化／鮮度警告
- [03_compounding_knowledge.md](03_compounding_knowledge.md) — J3: 複利的知識構築（前提→応用）
- [04_question_driven.md](04_question_driven.md) — J4: 質問駆動学習
- [05_metacognition.md](05_metacognition.md) — J5: メタ認知支援
- [06_cross_cutting_mvp.md](06_cross_cutting_mvp.md) — 横断観察・組み合わせ・MVP・未決質問

## 全体俯瞰

| サブ | 短名 | 核心メカニズム | 既存属性との接続 | 推し度 |
|---|---|---|---|---|
| J1 | SRS | スケジュール（次回出題日） | weight / status="due" | ★★ |
| J2 | 忘却曲線 | 鮮度減衰の可視化 | last_touched timestamp | ★★ |
| J3 | 複利構築 | 前提→応用リンクの推薦 | link / parent | ★★★ |
| J4 | 質問駆動 | ノード=「問い」として再構成 | text プレフィックス / role | ★★ |
| J5 | メタ認知 | 思考パターン自己観察 | history / annotation | ★ |

## 論点一覧（ID 抜粋）

各ファイル末尾に正式な論点 ID（J1.1, J2.3 ... 形式）を持つ。
ここでは抜粋:

- **J1.A** SRS のアルゴリズム選択（SM-2 / FSRS / 単純線形 / 自作）
- **J1.B** 出題対象の選び方（全ノード / 明示マーク / status 条件）
- **J1.C** 出題 UI（モーダル / 専用ビュー / 既存マップ強調）
- **J2.A** 鮮度の指標（最終編集 / 最終閲覧 / 最終リンク追加）
- **J2.B** 表示方法（色温度 / 透明度 / バッジ / 物理メタファー）
- **J3.A** 前提関係の取り方（明示リンク / AI 推論 / DAG 構築）
- **J3.B** 推薦タイミング（明示要求 / バックグラウンド / カード形式）
- **J4.A** 「問い」の表現（`?` プレフィックス / role="Q" / 専用ノードタイプ）
- **J4.B** 問いの粒度（マップ全体 / subtree / 単ノード）
- **J5.A** 観察対象（編集行動 / 思考時間 / 改稿パターン / 確信度）
- **J5.B** フィードバック頻度（即時 / 週次 / 月次レポート）

## キーメッセージ

1. **J1〜J5 は単独より組み合わせで強い** — SRS（J1）+ 忘却曲線（J2）は事実上同じ情報を2つの UI で見せる関係
2. **N5（学習）原則との両立** — 「AI に学習を代行させない」ためには、SRS は答えを出すのではなく「あなたの言葉で再生せよ」を促す形が安全
3. **research-specific な歪みが必要** — Anki 型 SRS は「事実カード」前提だが、研究マップは「アイデア・問い・仮説」が主。そのまま流用できない
4. **メタ認知（J5）は他4つの上位レイヤー** — J1〜J4 のログを材料にする観察機構として位置付くのが自然
5. **既存 attribute (weight, status, details) で大半は始められる** — 新スキーマを増やす前に attribute 流用の MVP を試すべき

## 既存メモリ・他ブレストとの接続

- `automation_obstacles/04_what_not_to_automate.md` N5（学習）/ N4（一次接触）と整合
- `idea/00_topic_pool.md` の組み合わせ高効果ペア「J1 + 03 Status mode」を基盤前提に
- `idea/keyboard_modes/` Status mode（テンキー操作）が SRS 復習 UI と相性
- `idea/slideshow/` Guided Tour は J4 質問駆動の「問い順序」と接続可能
- `project_projection_vision`（科研費等を半年で）→ J3 複利的構築が「過去資産→申請書」線で直結
- `project_alglibmove_dogfood` の「認知層が薄い」指摘 → このブレストはその穴埋めの最初の素材

# 06. MVP Path — 最小実装案・段階導入・横断観察・未決質問

01-05 の論点を踏まえて **どこから始めるか** の候補と、
ファイル横断的な気づきと、未決の質問を集約する。
**採否は決めない**。akaghef がレビューで選ぶ素材。

## 1. MVP 候補（採否決めない、シナリオ別）

### Mv1: 「短期最小投資」シナリオ（半月以内）

| 軸 | 案 | 期待効果 |
|---|---|---|
| Render | Rd2 viewport カリング | 数百→数千ノード対応 |
| Search | Sr3 client fuzzy + Sr8.2 Cmd-K palette | 検索ゼロから「ある」へ |
| Nav | Nv1 MRU + Nv6 Cmd-K（Sr8.2 と統合） | workspace 切替コスト激減 |
| Cache | （触らない） | リスク回避 |

→ 既存コード破壊が最も小さい。
   ただし巨大化対策の根本は触らない。

### Mv2: 「中期基盤投資」シナリオ（1-2 ヶ月）

| 軸 | 案 | 期待効果 |
|---|---|---|
| Render | Rd2 + Rd3 LOD（ズーム別詳細） | 〜5k ノード対応 |
| Search | Sr4 SQLite WASM + Sr10 履歴 index | 数万行対応 + 履歴発掘 |
| Nav | Mv1 + Nv7 URL 共有強化 + Nv9 ブックマーク | 多様な entry point |
| Cache | Ch3.1 IDB read cache + Ch4.1 SW asset cache | オフライン部分対応 |

→ 検索体験が一段階上がる。
   IDB cache でリロード爆速。

### Mv3: 「長期構造投資」シナリオ（3-6 ヶ月）

| 軸 | 案 | 期待効果 |
|---|---|---|
| Render | Rd5 Canvas+SVG ハイブリッド + Rd8 クラスタ | 10k+ ノード対応 |
| Search | Sr4 + Sr6.3 hybrid（fuzzy + semantic） | 意味検索 |
| Nav | Mv2 + Nv4 サムネ + Nv10 タグ | 数百 workspace 対応 |
| Cache | Ch3.3 → Ch2.3 IDB 真実化 + Ch7 書き込み queue + Ch12 PWA | 完全オフライン |

→ 「世界モデル」と呼べるスケールまで耐える。
   ただし実装コスト最大。

### Mv4: 「痛み駆動」シナリオ（必要になったら）

- 痛みが出る順に 1 軸ずつ手当て
- 例: 検索が欲しくなったら Sr3 → Sr4
- 例: 開く時間が遅くなったら Rd2 → Rd3
- 例: 出張で困ったら Ch3 → Ch7

→ 推し（軽い見立て）: **akaghef の運用には Mv4 が最適**。
   研究中心で「最低限の不満解消」を最優先する研究者向き。

### Mv5: 「全部入り並行」シナリオ

各軸 1 個ずつ並行で MVP を出す。
リソース最大、効果も最大。
ただし AI 統合や論文生成（B1）等の他テーマと競合。

### Mv6: 「ベンチマーク先行」シナリオ

- まず計測基盤を作る（Lighthouse / 自作 perf log）
- 痛みを「主観」ではなく「数字」で確認
- 数字に応じて MV1-MV3 のどれを発動するか決める

→ Mv6 を Mv4 と組み合わせるのが堅実。

## 2. 段階導入ロードマップ案

### ロードマップ案 R1: 検索先行型

1. Sr3 fuzzy + Sr8.2 Cmd-K（最小検索）
2. Sr10 履歴 index（差別化）
3. Sr4 SQLite WASM（容量拡大）
4. Sr6 semantic（補強）
5. Render は痛みが来たら Rd2

「研究の振り返り・発掘」を最初に解く。
project_projection_vision の「世界モデル」生成支援に直結。

### ロードマップ案 R2: 描画先行型

1. Rd2 viewport カリング（即効）
2. Rd3 LOD（俯瞰救済）
3. Rd5 ハイブリッド（10k+ 対応）
4. Search は client fuzzy で済ませる

「重い」が最大の不満ならこちら。

### ロードマップ案 R3: オフライン先行型

1. Ch4 SW（リロード爆速）
2. Ch3.1 IDB read cache
3. Ch12 PWA manifest
4. Ch7 書き込み queue（cross_device 連携）

cross_device と統合的に進めるならこちら。

### ロードマップ案 R4: ナビ先行型

1. Nv1 MRU + Nv6 Cmd-K
2. Nv7 URL 共有強化
3. Nv4 サムネ
4. Nv9 ブックマーク

「workspace が増えて迷子になる」が痛みの中心ならこちら。

## 3. 横断観察（ファイル間の気づき）

### O1. 「検索」が他の全機能の前提になっている

- D1 重複検出（idea/maintenance_hygiene）→ 類似検索が前提
- B1 論文生成 → マップ構造 + 検索が前提
- C1 Devil's Advocate → 反論対象ノード検索
- I1 time travel → 履歴検索（Sr10）
- L5 検閲 → 機微語検索

→ Sr3-Sr14 の早期投資は **他テーマすべての基盤**。
  performance_scale の中で唯一「他に先んじて作る価値」がある。

### O2. Render と Search は性能的に独立だが UX は密結合

- 検索 hit を表示する時、巨大マップで Rd2 カリングが効いていないと
  「光らせるノードが画面外で見えない」
- Sr9.4 ハイライトには Rd2/Rd3/Rd9 が前提
- 設計時に統合的に考える必要あり

### O3. Cache と Search のレイヤは共有可能

- IDB に search index も置く
- 「オフラインで全文検索可能」は強い差別化
- 他ツール（Notion 等）はクラウド検索前提なので真似されにくい

### O4. workspace 横断は「データモデル」と「UX」の両方の問題

- データモデル: Sr.D1 global ID, Sr.D2 横断リンク
- UX: Nv1-Nv10
- 片方だけ整えても価値が出ない

### O5. 「巨大マップ」と「複数マップ」はトレードオフ

- 1 マップを大きくする vs マップを増やして横断
- M1 vs M2 + M3 は哲学的に対立
- 結論を急ぐべきでない。両方の道を残す

### O6. policy_privacy が設計を強く制約する

- Sr6 semantic（クラウド embedding）→ 制約
- Ch1.3 双方向 cloud sync → 制約
- L5 検閲必須 → 別投資が必要
- 「選べる選択肢が少ない」のは決断コストを下げる

### O7. AlgLibMove dogfood と関係ある

- project_alglibmove_dogfood: 認知層が無い
- 「AI が巨大マップを賢く要約・整理」 ← Rd8.3 意味クラスタ・Sr6 semantic と接続
- 認知層投資は性能投資と相互補完

### O8. cross_device と境界がある

- Ch1-Ch12（本ブレスト）と Sy1-Sy10（cross_device）は重複
- 本ブレストは「ローカル性能」軸
- cross_device は「デバイス間体験」軸
- 統合する場合は専用ブレスト（idea/sync_architecture/）を作る価値

## 4. 未決質問（akaghef のレビュー対象）

### Q1. ベンチマーク基準を決めるべきか

- Cn6.1-6.4 のどれを目指すか
- Mv6 ベンチ先行を採用するか
- 「数字無しの主観運用」でいくか

### Q2. 1 マップ巨大化と複数マップ分散のどちらを優先するか

- Cn4.1 vs Cn4.3
- 哲学的な選択、半年の投資先を分ける
- 両方を残す MVP もアリ（Mv4 痛み駆動）

### Q3. semantic search に投資すべきか

- Sr6 は LLM コスト・privacy 制約あり
- ローカル embedding（Ollama）を整備する覚悟があるか
- 「fuzzy だけで十分」と割り切る選択肢

### Q4. PWA 化を MVP に入れるか

- Ch12 + cross_device F2 の統合
- PWA は「やるなら早い方が良い」「やらないならやらない方が良い」の二択
- 中途半端な対応が一番悪い

### Q5. workspace 横断の data model 拡張に踏み込むか

- Sr.D1 global ID, Sr.D2 横断リンク
- 既存 vault スキーマの拡張
- 互換性破壊リスクあり

### Q6. 「履歴インデックス」は MVP 価値があるか

- Sr10 は M3E 独自の差別化要因
- だが「使う場面」がまだ見えにくい
- akaghef の「過去に遡る頻度」次第

### Q7. ベンチマーク自動化を CI に入れるか

- viewer.ts 7800 行への変更で性能 regression 検知
- 開発速度とトレードオフ

### Q8. Cmd-K palette の責務範囲

- workspace 切替のみ（Nv6.1）
- workspace + map + scope + node + action（Nv6.6 全部入り）
- 「全部入り」が VSCode/Linear 流の正解だが UX 設計コストあり

## 5. 推し（軽い見立て）の整理

採否は決めないが、参考のため軽く順位付け:

### 優先度 A（早期に効く・ROI 最大）

- Rd2 viewport カリング
- Sr3 client fuzzy + Sr8.2 Cmd-K palette
- Nv1 MRU + Nv6 Cmd-K

### 優先度 B（中期に必要になる）

- Sr4 SQLite WASM
- Sr10 履歴 index
- Rd3 LOD
- Ch3.1 IDB read cache + Ch4 SW

### 優先度 C（長期・条件付き）

- Rd5 Canvas+SVG ハイブリッド
- Sr6 semantic（ローカル embedding 整備後）
- Ch7 書き込み queue + Ch12 PWA
- Rd8 意味クラスタ

### 不採用候補（実装コスト過大 or 用途不一致）

- Rd6 WebGL（M3E のテキスト中心用途には過剰）
- Rd11 OffscreenCanvas（Safari 制約）
- Ch2.1 完全 IDB のみ（vault 資産破棄になる）

## 6. このブレストの位置づけ

- M3E の「半年で実用化」目標（project_projection_vision）と
  「巨大マップに耐える基盤」のトレードオフを考える材料
- 個別実装着手前に、5 軸の選択肢が手元にある状態を作る
- akaghef がレビューで「論点 ID 単位」で選んで方針確定する想定
- 関連既存ブレスト（cross_device / maintenance_hygiene / time_history）と
  論点をクロスリンクして、後の統合判断を可能にする

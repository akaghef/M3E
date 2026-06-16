# 07. MVP 路線・段階導入ロードマップ・未決質問

ブレストの締め。ここで初めて「ボリューム感」と「順序」を語るが、**採否は決めない**。
複数 MVP 案を並べる。

## 7.1 MVP 候補（4 案、いずれも採否未決）

### MVP-A. Zotero ローカル import（最小工数・即価値）

**スコープ**: Zotero の Local API で文献一覧を取得 → M3E に literature ノード生成

- 想定実装規模: ~100 行
- 認証: 不要（ローカル）
- 価値: 論文執筆時に文献マップが即できる
- リスク: 大量取り込みで爆発

**手順案**:
1. `m3e zotero pull` CLI コマンド or UI ボタン
2. `http://localhost:23119/api/users/0/items` を fetch
3. ノード生成（`type: literature`, `attributes.zotero.key` 付き）
4. dry-run プレビュー → 確認後 commit

### MVP-B. Git commit hook → M3E scratch（開発者向け）

**スコープ**: post-commit hook で M3E API を叩き、commit を scratch ノード化

- 想定実装規模: ~50 行（hook script）+ 既存 API 利用
- 認証: 不要
- 価値: 開発作業が自動でマップに残る
- リスク: ノイズ多すぎ → フィルタ必須

**手順案**:
1. `.git/hooks/post-commit` に script
2. M3E ローカル API（既存）に POST
3. ノード text に commit メッセージ、attribute に sha
4. scratch 配下、後で triage

### MVP-C. Obsidian Vault 一括 import（移行用）

**スコープ**: 指定 Vault フォルダを再帰スキャン → M3E ノード化

- 想定実装規模: ~200 行
- 認証: 不要
- 価値: 過去資産を一気に M3E に移行
- リスク: 数千ノード爆発、frontmatter ばらつき

**手順案**:
1. UI で「Vault フォルダ選択」
2. 再帰スキャン、`.md` 一覧取得
3. frontmatter / wikilink / tag パース
4. dry-run プレビュー（生成数確認）
5. 専用 workspace に分離投入

### MVP-D. M3E subtree → LaTeX export（論文出力）

**スコープ**: 選択 subtree を IMRAD 構造で .tex 出力

- 想定実装規模: ~300 行（テンプレ含む）
- 認証: 不要
- 価値: 論文初稿の自動化
- リスク: フォーマット制約、引用処理

**手順案**:
1. UI で「subtree 選択 → Export to LaTeX」
2. ノードの tag/attribute から section 割り当て
3. テンプレに穴埋め（IMRAD）
4. 文献ノードは `\cite{...}` 化、.bib 別出力
5. ローカル `.tex` 保存（Overleaf push は v2）

## 7.2 段階導入ロードマップ（参考、決定ではない）

| Phase | 内容 | 想定 |
|-------|------|------|
| Phase 0 | 統合インフラの最低限（共通 attribute スキーマ）| 1 週 |
| Phase 1 | MVP-A（Zotero）| 1〜2 週 |
| Phase 2 | MVP-B（Git hook）| 1 週 |
| Phase 3 | MVP-C（Obsidian import）| 2 週 |
| Phase 4 | MVP-D（LaTeX export）| 2〜3 週 |
| Phase 5 | Calendar import（H2）| 2 週 |
| Phase 6 | VSCode 拡張（H6）| 4 週 |
| Phase 7 | 双方向同期（Notion or Linear）| 4 週 |
| Phase 8 | プラグイン API 抽出 | 4 週 |

→ project_projection_vision の「半年で科研費出力」目標に対し、Phase 1+4 が直結。
→ Phase 5 以降は研究時間との比較でリソース判断。

## 7.3 ローカル統合先行戦略（推し）

OAuth 不要で着手できる統合だけで **1セット** 揃う:

- H1 Git ローカル
- H3 Obsidian ローカル
- H4 Zotero ローカル
- H5 LaTeX ローカル
- H6 VSCode 拡張

これだけで 8 割の研究者ユースケースをカバー。
クラウド系（H2 Calendar, H7 Notion/Linear/Jira, H1 GitHub, H4 Zotero Web, H5 Overleaf）は **第二波**。

## 7.4 統合の優先順位マトリクス

| 統合 | 価値 | 工数 | プライバシー難 | スコア |
|-----|------|------|--------------|-------|
| H4 Zotero ローカル | 高 | 小 | 低 | ⭐⭐⭐ |
| H5 LaTeX ローカル | 高 | 中 | 低 | ⭐⭐⭐ |
| H1 Git hook | 中 | 小 | 低 | ⭐⭐ |
| H3 Obsidian import | 中 | 小 | 低 | ⭐⭐ |
| H6 VSCode 拡張 | 高 | 大 | 低 | ⭐⭐ |
| H5 Overleaf push | 高 | 中 | 中 | ⭐⭐ |
| H1 GitHub Issue | 中 | 中 | 中 | ⭐ |
| H2 Calendar import | 中 | 中 | 高 | ⭐ |
| H7 Notion 双方向 | 中 | 大 | 高 | △ |
| H7 Linear/Jira | 中 | 中 | 中 | △ |

## 7.5 未決質問（最重要）

統合に進む前に答えが必要な質問:

### Q1. 統合先の優先順位はリソース次第か、ユーザ嗜好か？
- akaghef にとって最も使うツールは Zotero / VSCode / Git
- → 客観的優先と一致するが要確認

### Q2. プラグイン化を初期から目指すか、内蔵で始めるか？
- 内蔵で 3〜4 個実装してから抽出が現実的
- ただし最初の設計で `external.<service>` スキーマだけは決めておく

### Q3. 双方向同期は必要か？それとも片方向で十分か？
- M3E が思考、外部がタスク管理 → 片方向（read-only ミラー）でも価値十分
- 双方向に踏み込むかは個別判断

### Q4. M3E 自身を Obsidian Vault として持つ案は採るか？
- ノード = .md ファイル化、git diff フレンドリー、Obsidian 互換
- 現行 m3e-map.json と二重管理 or 移行か？

### Q5. クラウド統合のトークン管理を OS keychain に統一するか？
- ブラウザ環境では keychain アクセス難
- Electron / Tauri など native ラッパー必要
- 現行 web 版で OAuth する場合の設計

### Q6. どの統合をどの workspace に閉じ込めるか？
- 「研究プロジェクト workspace に Zotero」は OK
- 「個人タスク workspace に Linear」は OK
- 全 workspace 横断で同期する統合は ID 衝突リスク

### Q7. 統合の有効化はワンクリックか、設定詳細か？
- ワンクリック → デフォルト設定で開始
- 詳細設定 → 慎重なユーザ向け
- 両方提供？

### Q8. dry-run プレビューは必須にするか？オプションか？
- import 系は dry-run 必須（後戻り困難）
- export 系はオプション（毎回プレビューは煩雑）

### Q9. 外部由来ノードの「所有権」をどう表現するか？
- 削除可能 vs 削除不可
- 編集可能 vs read-only
- 外部更新で上書きされる挙動の制御

### Q10. ノード type 体系を統合用に拡張するか？
- 既存 node type に `literature` `commit` `event` `issue` を追加か
- それとも `attributes.source` で識別か
- type 増殖 vs attribute フラット どちらが扱いやすいか

## 7.6 横断的気づき（最終ファイルとして）

### Insight 1. 統合の本質は「ID 戦略 × プライバシー境界」
他のすべての論点（同期方向・トリガー・粒度）は、この2つが決まれば派生する。
最初に決めるべき2項目。

### Insight 2. ローカル統合だけで 80% 達成可能
H1ローカル + H3 + H4ローカル + H5ローカル + H6 で研究者用途の主要シーンが回る。
クラウド統合（OAuth 系）に手を出すかは戦略判断。

### Insight 3. 「import → export → 双方向」の順で進化
P1 → P2 → P4 → P3 の順で複雑度が上がる。
逆順や飛び級は破綻リスク高い。

### Insight 4. ノード attribute スキーマの早期確定が鍵
`external.<service>` 名前空間を最初の統合（MVP-A）で決めれば、後続 統合の追加コストが下がる。
スキーマ設計を後回しにすると統合ごとの ad-hoc が積もる。

### Insight 5. M3E の差別化ポイントは「構造可視化」
既存ツールは text と list が中心。M3E が **構造（グラフ・空間）** を担う。
統合は「既存ツールの強みを活かしつつ、構造だけ M3E が引き受ける」設計。

### Insight 6. dogfood 第一候補は H1 Git + H6 VSCode
M3E 自身の開発に M3E を使う（O1 / project_alglibmove_dogfood）ためには
Git と VSCode が最重要。これらを統合すれば dogfood の摩擦が減る。

### Insight 7. project_projection_vision との整合
半年で科研費出力 → MVP-A（Zotero）+ MVP-D（LaTeX）+ 申請書テンプレ（H5.5.f）の3点セット。
他の統合は副次的。

### Insight 8. Notion 統合は「やらない」も選択肢
コスト大、価値中、プライバシー難。
研究室の Notion を諦めて M3E を共通言語にする戦略もアリ。
逆に「やる」場合は中途半端でなく深く統合する必要。

### Insight 9. 統合先が増えるほどマップが「外部依存」化
全ノードの 50% が外部由来になると、M3E は単なるビューワーに退化。
「自分の思考ノード」と「外部由来ノード」の比率を意識する設計。

### Insight 10. テスト戦略の盲点
統合は外部 API モックが必須だが、本物の API 仕様変更には追従できない。
定期的な「実環境統合テスト」が運用負荷。

## 7.7 ブレスト終了後の推奨アクション

（このブレストでは「決めない」が原則だが、レビュー時の参考に）

1. Q1〜Q10 に akaghef が回答
2. MVP-A / MVP-D を実装候補として選定（または棄却）
3. ノード attribute スキーマ `external.<service>` を別 idea として深掘り
4. 統合先の優先順位を 1〜2 個に絞る（同時進行は 2 個まで）
5. プラグイン化は Phase 8 まで保留、内蔵で進める

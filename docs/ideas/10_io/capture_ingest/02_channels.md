# 02. Channels — 入力チャネル候補列挙

00_topic_pool の A1-A10 を起点に、A11-A20 を拡張して並べる。
**採否は決めない**。各チャネルについてユースケース／実装方式バリエーション／未決を列挙。

---

## チャネル分類軸

| 軸 | 値 |
|---|---|
| **Push/Pull** | ユーザーが送る / システムが取りに行く |
| **同期/非同期** | 即 scratch 化 / 後でバッチ |
| **構造性** | 単発テキスト / 構造（章節）あり / マルチメディア |
| **ローカル/クラウド** | デバイス内完結 / 外部サーバ経由 |
| **Privacy リスク** | 低（ローカル）／中（HTTPS）／高（メール・Slack） |

---

## A1. 音声入力フロー（マイク常時待機）

00_topic_pool 起点: マイク常時待機、句点で自動分割→scratch、後で triage。

### 実装方式バリエーション
| 案 | 録音範囲 | 文字起こし | 分割 |
|---|---|---|---|
| A1-a 常時待機 | 24時間ON | リアルタイム Whisper | 句点・無音 |
| A1-b プッシュ&トーク | キー押下中のみ | 録音後に Whisper | 1キャプチャ=1ノード |
| A1-c タイマー区切り | 5分単位で chunk | 後処理 | chunk=1ノード |
| A1-d Wake word | 「メモ」と言ったら起動 | 起動後 Whisper | 句点 |
| A1-e 散歩モード | スマホアプリで連続録音 | 帰宅後 batch | 段落自動推定 |

### ユースケース
- 散歩中の研究アイデア
- 風呂上がりの一言
- 実験室での観察ログ
- 移動中の論文要約口述
- ミーティング自分発言録（要 consent）

### 未決
- 文字起こしエンジン（Whisper local / OpenAI API / Apple Speech）
- 句点自動挿入の精度
- 沈黙の扱い（カット vs 残す）
- 録音データの保存期間（C5 連動）
- 暗号化タイミング（録音直後 vs 文字起こし後）

---

## A2. ブラウザクリップ拡張

任意ページ→ノード紐付け保存。

### 実装方式バリエーション
| 案 | UI | 保存単位 | 親ノード指定 |
|---|---|---|---|
| A2-a popup 拡張 | 拡張アイコンクリック | 選択テキスト or ページ全体 | popup 内で選択 |
| A2-b 右クリックメニュー | 「M3E に保存」 | 選択範囲 | デフォルト scratch |
| A2-c bookmarklet | ブックマークレット起動 | ページ全体 | URL parameter |
| A2-d ホットキー | Cmd+Shift+M | 選択範囲 | 直前選択ノード |
| A2-e ハイライト保存 | Web 上ハイライト→自動 | ハイライト箇所 | URL ベース集約 |

### 取り込み内容
- 選択テキストのみ
- ページ全体（Readability 化）
- スクリーンショット付き
- メタデータ（OG image, author, date）
- arXiv なら abstract + bibtex 自動

### ユースケース
- arXiv abstract をそのままノード化
- ブログ記事の要点クリップ
- Wikipedia 段落の保存
- 引用候補としてマーク
- 競合製品リサーチのクリップ

### 未決
- 拡張ストア配布 vs unpacked
- 認証（M3E ローカルサーバとの通信）
- CORS / file://
- Firefox / Safari 対応範囲
- 親ノード選択 UI

---

## A3. PDF 取り込み（論文章節構造）

研究者向け最重要チャネル候補。

### 実装方式バリエーション
| 案 | 構造抽出 | ノード化粒度 | 引用情報 |
|---|---|---|---|
| A3-a TOC ベース | PDF 目次から | 章/節 | bibtex 別途 |
| A3-b 見出し検出 | フォント解析 | 章/節/小節 | 自動抽出 |
| A3-c GROBID | 学術 PDF 専用 | 段落まで | 完全抽出 |
| A3-d AI 構造推定 | LLM に投げる | LLM 判断 | LLM 抽出 |
| A3-e ページ単位 | 構造解析せず | 1ページ=1ノード | 手動 |

### ユースケース
- 査読論文の構造把握
- 関連研究レビュー（10本一気に）
- 自著論文の修正箇所マッピング
- 教科書1章の構造化
- 議事録 PDF の項目化

### ノード化テンプレ案
```
[論文タイトル]
├─ Abstract
├─ 1. Introduction
│   ├─ 1.1 Background
│   └─ 1.2 Contribution
├─ 2. Method
│   ├─ ...
├─ References (子: 各引用)
└─ Figures (子: 各 figure キャプション)
```

### 未決
- ローカル処理 vs クラウド OCR
- figure の保存形式（画像添付 vs キャプションのみ）
- 数式の扱い（LaTeX 復元 vs 画像）
- 著作権配慮（全文保存可否）
- bibtex / citation 生成

---

## A4. OCR / 画像→ノード

ホワイトボード写真、手書きノート構造化。

### 実装方式バリエーション
| 案 | OCR エンジン | 構造抽出 | 出力形態 |
|---|---|---|---|
| A4-a Tesseract local | OSS | テキストのみ | 単一ノード |
| A4-b Cloud Vision | Google | レイアウト情報あり | 領域=ノード |
| A4-c Apple Vision | iOS/macOS | 手書き対応 | テキスト |
| A4-d AI multimodal | GPT-4V/Claude | 構造推定 | ノード木 |
| A4-e Excalidraw 風変換 | 手書き→ベクタ | 図形保持 | embedded SVG |

### 取り込み対象
- ホワイトボード写真
- 手書きノート（紙）
- 書籍の写真
- スクリーンショット
- iPad 手書き（Apple Pencil）

### 未決
- 図と文字の混在処理
- 矢印・関係線の認識
- 元画像の保管（D3 と接続）
- 機微情報マスキング（L2）
- 多言語混在（日英混じり）

---

## A5. メール→ノード

特定アドレスへ送信→scratch 化。

### 実装方式バリエーション
| 案 | 受信方式 | アドレス | パース |
|---|---|---|---|
| A5-a IMAP polling | 自前メールアカウント | inbox+m3e@gmail.com | subject=タイトル |
| A5-b 専用ドメイン | inbox@m3e.app | ユニーク id 付与 | 全文 |
| A5-c forwarding rule | 既存 inbox から rule | label ベース | 添付対応 |
| A5-d Mailgun/SendGrid | webhook | フォーム的アドレス | JSON で受け取る |
| A5-e 自分宛 reply | 既存メールに返信→scratch | rule | 文脈引用 |

### subject パース案
- `[m3e]` prefix → タイトル
- `#tag` 自動抽出
- `parent: nodeId` ヘッダで親指定
- 添付ファイル → 子ノード添付

### ユースケース
- 出先からの一行メモ
- 受信メールの転送（重要メールをマップに）
- メーリスのアーカイブ取り込み
- カレンダー招待→ノード化（H2 と接続）

### 未決
- privacy（メール本文がサーバ通過）
- spam 対策
- 認証（送信元アドレス検証）
- HTML メール vs plain
- 添付ファイル上限

---

## A6. Slack / Discord ブリッジ

チャットの一行に reaction→scratch。

### 実装方式バリエーション
| 案 | トリガー | 取り込み範囲 | 親ノード |
|---|---|---|---|
| A6-a 特定 emoji reaction | `:m3e:` 押下 | 該当発言1行 | デフォルト scratch |
| A6-b mention bot | `@m3e save` | 直前 N 行 | コマンド引数 |
| A6-c slash command | `/m3e capture` | 入力テキスト | 引数 |
| A6-d スレッド全部 | 特定スレを丸ごと取り込み | スレ全体 | 1ノード木 |
| A6-e 自動 ingest | 特定チャンネル全発言 | 全部 | 自動 |

### ユースケース
- 研究室 Slack の議論抽出
- Discord の論文紹介チャンネル取り込み
- 自分の独り言チャンネルから
- AI bot との会話履歴

### 未決
- OAuth / bot token 管理
- private channel の許容
- メッセージ履歴の遡り取得
- 暗号化（Slack 経由は plaintext 通過）
- bot 設置の運用コスト

---

## A7. コード→ノード（git commit / TODO コメント）

### 実装方式バリエーション
| 案 | 取り込み源 | トリガー | 形態 |
|---|---|---|---|
| A7-a post-commit hook | git commit msg | commit 時 | scratch ノード |
| A7-b TODO scanner | コード内 `// TODO:` | 定期 scan | scratch |
| A7-c PR description | GitHub PR | webhook | scratch |
| A7-d issue 連携 | GitHub Issue | webhook | scratch |
| A7-e CHANGELOG 自動 | semantic-release 連動 | release 時 | scratch |

### prefix 規約案
- `m3e:` で始まる commit message を取り込み
- `// TODO(m3e):` コメントを取り込み
- `feat:` / `fix:` 全部取り込み（conventional commits）

### ユースケース
- M3E 自身の開発履歴を M3E に流す（dogfood）
- TODO コメントを忘れない
- リリースノート→マップ
- 別 repo の進捗追跡

### 未決
- どの repo を対象にするか
- 双方向同期するか（マップ→コード）
- private repo の token 管理
- 既存 backlog/ との重複（feedback_todo_single_file）

---

## A8. AI チャット履歴→マップ

00_topic_pool で ⭐ 高レバレッジ候補。

### 実装方式バリエーション
| 案 | 入力形式 | 抽出単位 | 構造化 |
|---|---|---|---|
| A8-a Claude.ai export | JSON export | 1会話=1木 | turn=ノード |
| A8-b ChatGPT export | JSON export | 同上 | 同上 |
| A8-c MCP server | live | turn 終了時 | 自動 |
| A8-d copy-paste | テキスト | 手動 | AI 構造抽出 |
| A8-e Claude Code session | session log | session=1木 | tool call も含む |

### 抽出粒度
- ユーザー発話のみ
- AI 返答のみ
- 全 turn
- 「結論」「論点」「未決」を AI が抽出して構造化
- code block のみ抽出

### ユースケース
- Claude との議論を後でマップ統合
- 論文ドラフトのアウトラインを AI と詰めた結果を保存
- Claude Code の session を「自分の作業ログ」化
- GPT との壁打ち履歴のアーカイブ

### 未決
- 取り込み単位（会話単位 vs turn 単位）
- 機微情報（プライベート対話）の暗号化
- AI 二重処理（取り込んだ AI 対話をさらに AI 要約）
- 既存 ai_subagent.ts との関係

### 関連
- 00_topic_pool の組み合わせペア「A8 + B1」（論文化への一気通貫）

---

## A9. モバイル「共有」シート（iOS/Android）

### 実装方式バリエーション
| 案 | 配布形態 | 機能範囲 |
|---|---|---|
| A9-a ネイティブアプリ | Swift/Kotlin | フル UI |
| A9-b PWA | ブラウザ | 制限あり |
| A9-c Shortcuts (iOS) | スクリプト | URL scheme |
| A9-d Tasker (Android) | スクリプト | URL scheme |
| A9-e Capacitor/Tauri Mobile | Web 技術 | 中規模 |

### 取り込み入力
- テキスト（Twitter, Notes）
- URL（Safari, Chrome）
- 画像（カメラ, アルバム）
- 音声メモ（Voice Memos）
- PDF（Files）
- Apple Notes 共有

### 未決
- アプリ開発コスト vs PWA 妥協
- 認証（M3E サーバとの通信）
- オフライン対応
- 通知（リマインドや triage 催促）
- F2 スマホ専用 capture（00_topic_pool）と統合

---

## A10. 常駐 quick-add ウィジェット

Mac/Win メニューバー即捕捉。

### 実装方式バリエーション
| 案 | プラットフォーム | 起動方式 |
|---|---|---|
| A10-a Electron tray | Mac/Win/Linux | クリック / hotkey |
| A10-b Tauri tray | 軽量 | クリック / hotkey |
| A10-c macOS native menu bar | Swift | hotkey |
| A10-d Win system tray | C#/Rust | hotkey |
| A10-e Raycast extension | Mac 限定 | Raycast から |
| A10-f Alfred workflow | Mac 限定 | Alfred から |

### UI バリエーション
- 単一 input box（Drafts 風）
- 複数行 + メタ入力
- ボイス録音ボタン付き
- 直近 capture 履歴表示
- 親ノード選択 dropdown

### 未決
- M3E ローカルサーバとの通信プロトコル
- 起動速度目標（< 200ms）
- フォーカス処理（フルスクリーン中も起動可？）
- マルチモニタ対応
- 既存 Raycast ユーザーへの低摩擦提供

---

## 拡張候補（A11-A20）

00_topic_pool 外の追加候補。

### A11. RSS / Feed 取り込み
- 任意フィードを購読 → 新着 entry を scratch
- 用途: 論文 RSS、ブログ、arXiv 新着

### A12. カレンダー予定→ノード
- Google Calendar / iCloud から予定 ingest
- 用途: ミーティングメモのテンプレ事前準備
- H2 と直接統合

### A13. クリップボード監視
- コピー履歴を監視 → 特定パターン（URL等）を auto-suggest
- 用途: 「コピーしたら自動で M3E に？」プロンプト
- 警告: privacy 高リスク（opt-in 必須）

### A14. ファイルシステム監視
- 特定フォルダ（~/m3e-inbox/）に置かれたファイルを auto-ingest
- 用途: スキャナー出力の自動投入、Dropbox 経由

### A15. IFTTT / Zapier / Make 経由
- webhook で何でも受ける
- 用途: ユーザー任意の外部サービス（Twitter favorite, Pocket 等）

### A16. ボイスメモアプリ統合
- iOS Voice Memos の自動取り込み
- 用途: 既存ボイスメモ蓄積を活かす

### A17. Apple Notes / Google Keep 同期
- 既存メモアプリの双方向同期
- 用途: 移行体験、源流ツール温存

### A18. スクリーンショット自動取り込み
- ~/Desktop の screenshot を auto OCR して scratch
- 用途: 「あとで参照」スクショの自動構造化

### A19. リマインダー / Todo アプリ統合
- Apple Reminders / Todoist / Things から取り込み
- 用途: タスク的 capture と思考的 capture の橋渡し

### A20. ペーパー（紙）→ M3E
- 専用紙 + アプリ撮影で構造化（Rocketbook 風）
- 用途: 手書き派の取り込みパイプ

---

## チャネル横断比較表

| ID | チャネル | 摩擦 | 構造性 | privacy リスク | 実装コスト | ⭐ |
|---|---|---|---|---|---|---|
| A1 | 音声 | 極低 | 低 | 中 | 中 | ⭐ |
| A2 | ブラウザ拡張 | 低 | 中 | 中 | 中 | ⭐ |
| A3 | PDF | 中 | 高 | 低 | 高 | ⭐⭐ |
| A4 | OCR/画像 | 中 | 中 | 中 | 中 | |
| A5 | メール | 低 | 低 | 高 | 中 | |
| A6 | Slack/Discord | 低 | 低 | 高 | 中 | |
| A7 | コード | 自動 | 中 | 低 | 低 | |
| A8 | AI 履歴 | 低 | 高 | 中 | 中 | ⭐⭐ |
| A9 | モバイル共有 | 極低 | 低 | 中 | 高 | ⭐ |
| A10 | menu bar widget | 極低 | 低 | 低 | 中 | ⭐ |
| A11 | RSS | 自動 | 中 | 低 | 低 | |
| A12 | カレンダー | 自動 | 中 | 低 | 低 | |
| A13 | clipboard | 自動 | 低 | 高 | 低 | |
| A14 | ファイル監視 | 低 | 低 | 低 | 低 | |
| A15 | webhook | 任意 | 任意 | 中 | 低 | ⭐ |
| A16 | ボイスメモ | 低 | 低 | 中 | 低 | |
| A17 | メモアプリ同期 | 自動 | 中 | 中 | 高 | |
| A18 | screenshot | 自動 | 低 | 中 | 中 | |
| A19 | Todo アプリ | 自動 | 中 | 中 | 中 | |
| A20 | 紙 | 中 | 中 | 中 | 高 | |

⭐ は研究者ワークフローで高レバレッジな候補。

---

## チャネル選定の戦略案

### 戦略 S1: 「研究者が今日始められる」最小セット
- A10（menu bar）+ A2（拡張）+ A8（AI 履歴）
- 既存ツール無しで M3E のみで完結

### 戦略 S2: 「歩きながら捕捉」セット
- A1（音声）+ A9（モバイル）
- F2 と統合

### 戦略 S3: 「文献ワークフロー」セット
- A3（PDF）+ A2（拡張）+ A11（RSS）
- 論文ベース研究に特化

### 戦略 S4: 「対話アーカイブ」セット
- A8（AI 履歴）+ A6（Slack）+ A5（メール）
- 議論ログを M3E に集約

### 戦略 S5: 「環境自動化」セット
- A14（ファイル）+ A15（webhook）+ A18（screenshot）
- ユーザーが意識せず勝手に貯まる

---

## 論点 ID 一覧（このファイル）

- A1-A10: 起点チャネル
- A11-A20: 拡張チャネル候補
- S1-S5: チャネル組み合わせ戦略
- 各チャネル内の sub-論点（例: A3-a〜A3-e）

次ファイル `03_processing_pipeline.md` で取り込み後の加工処理を扱う。

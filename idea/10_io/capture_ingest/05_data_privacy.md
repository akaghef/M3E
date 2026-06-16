# 05. Data & Privacy — データモデル・暗号化・互換性

取り込んだものをどこに、どんな形で、誰が読める形で残すか。
**policy_privacy（クライアント暗号化必須）** との整合性が最重要。

---

## D1. scratch ノード形態

### 案 D1-a: フラット配列
- 全 capture が `scratch` 直下に1階層で並ぶ
- 利点: シンプル
- 欠点: 件数増えると見えない

### 案 D1-b: チャネル別グループ
```
scratch/
├─ voice/
├─ pdf/
├─ web/
├─ email/
└─ ai_chat/
```
- 利点: 出自が分かる
- 欠点: cross-channel テーマが見えない

### 案 D1-c: 日付別
```
scratch/
├─ 2026-04-16/
├─ 2026-04-15/
```
- 利点: 時系列把握しやすい
- 欠点: 古いものが埋もれる

### 案 D1-d: 状態別
```
scratch/
├─ untriaged/
├─ in_progress/
└─ archived/
```

### 案 D1-e: ハイブリッド（フラット + view）
- 物理は D1-a、表示は filter で D1-b/c/d を切替

**推し度**: D1-e。データ単純、表示柔軟。

---

## D2. メタデータスキーマ

各 scratch ノードに付けるメタ情報。

### 必須候補
- `id` — node id（既存）
- `text` — 本文（既存）
- `created_at` — タイムスタンプ
- `captured_via` — チャネル ID（A1-A20）
- `source` — URL / ファイルパス / app 名
- `triaged` — boolean

### 任意候補
- `source_app` — 「Drafts」「Slack」等
- `source_user` — 自分以外も capture する場合
- `lang` — ja/en
- `raw_data_id` — 生データ参照
- `tags` — チャネルタグ + 自動タグ
- `parent_suggested` — AI 提案の親
- `ai_processed` — AI パスを通したか
- `processing_log` — paipipeline 履歴
- `confidence` — AI 抽出の確信度
- `prompt` — 取り込み prompt（A8 用）

### 案
- D2-a 最小（必須のみ）
- D2-b 標準（必須 + 一般任意）
- D2-c 完全（全部）

**推し度**: D2-b、AI 関与時のみ D2-c。

---

## D3. 添付ファイルの保管場所

画像・PDF・音声 raw データをどこに置くか。

| 案 | 保管先 | 利点 | 欠点 |
|---|---|---|---|
| D3-a M3E json 内 base64 | 同一ファイル | シンプル | json 肥大 |
| D3-b 別フォルダ | `attachments/` | 軽い | 参照リンク管理 |
| D3-c IndexedDB | ブラウザ DB | offline ◎ | export 困難 |
| D3-d 外部 storage | S3 / Supabase | 軽い | privacy 注意 |
| D3-e ハイブリッド | 小: json / 大: 別 | バランス | 複雑 |

**推し度**: D3-b（別フォルダ）+ D3-e で大物だけ別。

---

## D4. 取り込み元 raw データの保持期間

例: 音声録音原本、PDF原本、メール原本。

### 案
| 案 | 保持期間 | サイズ管理 |
|---|---|---|
| D4-a 永久 | 削除しない | 肥大 |
| D4-b 30日 | 自動削除 | 中 |
| D4-c triaged 後削除 | triage 完了で raw 削除 | 良 |
| D4-d ユーザー指定 | ノード単位で keep フラグ | 柔軟 |
| D4-e 圧縮 + 期限 | 古いものは zip | バランス |

**推し度**: D4-c default + D4-d で重要なものは保持。

---

## D5. ワークスペース選択（複数 vault）

複数の M3E ワークスペースがある時、capture はどこに行くか。

### 案
- D5-a default vault 固定
- D5-b 直前アクティブ vault
- D5-c capture 時に毎回選択
- D5-d チャネル別マッピング（仕事は work-vault、研究は research-vault）
- D5-e タグ別（#work tag → work-vault）

**推し度**: D5-d。チャネル定義時に紐付け。

---

## D6. M3E json 直書きか別ストアか

### 案 D6-a: 既存 m3e-map.json に直書き
- 利点: 単純、既存ツール再利用
- 欠点: 並行 write 競合リスク

### 案 D6-b: capture 専用ストア
- `captures.json` 別ファイル
- ingest 完了で main map にマージ
- 利点: 競合回避、staging エリア
- 欠点: 二重管理

### 案 D6-c: イベントログ
- append-only log
- main map は log から再構築可能
- 利点: 履歴完全、time travel 容易
- 欠点: 実装複雑

### 案 D6-d: SQLite / IndexedDB
- json を捨てて DB へ
- 利点: 大規模対応
- 欠点: 既存 json 互換喪失

**推し度**: D6-b（staging 別、後でマージ）。  
00_topic_pool I1（time travel）見越すなら D6-c も魅力的。

---

## D7. チャネル設定の永続化

各チャネルの設定（メールアドレス、API key、認証 token 等）。

### 案
- D7-a 平文 json（`config.json`）
- D7-b OS keychain（Keychain/Credential Manager）
- D7-c 暗号化 json（passphrase）
- D7-d 環境変数のみ

**推し度**: 機微度別。token 系は D7-b、設定は D7-c。

---

## D8. capture 履歴ログ

「いつ何を capture したか」の記録。

### 案
- D8-a なし
- D8-b 別ファイル（`capture_history.jsonl`）
- D8-c 各ノードの metadata 内
- D8-d 専用 history view（時系列ダッシュボード）

**推し度**: D8-b + D8-d。

---

## D9. 既存ツールとの互換

### import 元
- Drafts JSON export
- Apple Notes export
- Obsidian vault
- Logseq graph
- Roam EDN
- Notion export
- Markdown フォルダ
- Bear export

### export 互換性
- Markdown
- JSON-LD（J 系）
- bibtex（A3, P6）
- CSV（メタ列含む）

### 案
- D9-a import/export を完全保証
- D9-b 主要形式のみ
- D9-c 取り込み専用（一方向）
- D9-d M3E 独自形式優先

**推し度**: D9-b（主要形式 import）。

---

## D10. バックアップ・同期

### 案
- D10-a ローカルファイル + 手動同期
- D10-b iCloud/Dropbox 経由（既存）
- D10-c 専用同期サーバ
- D10-d Git ベース（H1）
- D10-e CRDT（複数デバイス live 同期）

**推し度**: D10-b（既存）+ D10-d（dogfood）。

---

## L1. クライアント暗号化の必須範囲

policy_privacy 直接対応。

### 案 L1-a: 全 capture を暗号化
- 利点: 安全
- 欠点: 検索しにくい、AI 連携困難

### 案 L1-b: 機微タグ付きのみ暗号化
- `#secret` `#personal` 等
- 利点: 柔軟
- 欠点: ユーザー判断必要

### 案 L1-c: チャネル別暗号化方針
- 音声・メール: 暗号化
- 公開 URL クリップ: 平文
- 利点: 自動判断
- 欠点: 設定複雑

### 案 L1-d: workspace 単位
- vault ごとに暗号化方針
- D5-d と組み合わせ

### 案 L1-e: capture 直後は平文 + triage 時に暗号化判断

**推し度**: L1-c default + L1-d で workspace ポリシー。

---

## L2. AI パイプライン送信前の検閲

00_topic_pool L5 と直結。

### 案
- L2-a 検閲しない（ユーザー責任）
- L2-b パターン検閲（メアド、電話番号、クレカ等）
- L2-c タグ検閲（`#secret` は AI に送らない）
- L2-d AI 自身に「機微判定」させてから送信
- L2-e 確認ダイアログ（送信前にプレビュー）

**推し度**: L2-b + L2-c の組合せ。

---

## L3. クラウドリレー（メール/モバイル）の中間データ

メール A5、モバイル A9、Slack A6 等は外部サーバを経由する。

### 案
- L3-a 取り込み完了後に元データ即削除
- L3-b 一定期間後削除（30日）
- L3-c 削除しない（信頼ベース）
- L3-d E2EE（送信時に暗号化、サーバは復号できない）

### 中継サーバの選択
- 自前サーバ（自分で運用）
- 既存サービス（Gmail / Slack）
- Cloudflare Workers / Lambda（サーバレス）
- なし（モバイルは PWA で直接ローカルサーバへ）

**推し度**: L3-a + 自前サーバ or 直接ローカル接続。

---

## L4. 出典 URL の匿名化オプション

公開・共有時にクリップ元 URL を残すか。

### 案
- L4-a 残す（透明性）
- L4-b 残さない（プライバシー）
- L4-c ハッシュ化（同一性のみ判定可能）
- L4-d ノード単位で選択

---

## L5. アクセスログ

「誰がいつ何を見たか」の記録。

### 案
- L5-a 取らない
- L5-b ローカル log
- L5-c 共有 vault のみ取る
- L5-d export 操作だけ取る

**推し度**: L5-d（export だけ）。情報漏洩追跡用。

---

## L6. 「忘れる権利」設計

入れたものを後で完全削除できるか。

### 案
- L6-a 削除可能（ノード削除 → 全痕跡消える）
- L6-b 削除可能 + 履歴ログにも消去
- L6-c soft delete（archive 移動）
- L6-d 削除困難（git history 残る）

**推し度**: L6-b。

---

## L7. 共有 vault 時の capture 帰属

複数人で同じ vault を使う場合。

### 案
- 全 capture に `captured_by` 必須
- 匿名 capture も許可
- ロール別権限（閲覧者は capture 不可）

E1（リアルタイム共同編集）と接続。

---

## L8. AI 取り込みの再現性

A8（AI 履歴取り込み）等で、後で「何の prompt で取り込まれたか」を追跡可能にするか。

### 案
- L8-a prompt を保存しない
- L8-b prompt を metadata に
- L8-c prompt + AI モデル名 + temperature
- L8-d prompt + raw response も

**推し度**: L8-c。再現性とサイズのバランス。

---

## データモデル例（D1-e + D2-b + D6-b ベース）

### main `m3e-map.json`
```jsonc
{
  "nodes": [
    {
      "id": "scratch_xxx",
      "text": "音声メモの本文",
      "type": "scratch",
      "captured_via": "A1-e",
      "source": "voice_memo_2026-04-16T10:23",
      "created_at": "2026-04-16T10:23:14Z",
      "triaged": false,
      "tags": ["voice", "research-idea"],
      "parent_suggested": "node_research_pool",
      "ai_processed": false,
      "raw_data_id": "raw_audio_xxx"
    }
  ]
}
```

### staging `captures.jsonl`
```jsonl
{"channel": "A1", "raw": "...", "ts": "...", "status": "pending"}
{"channel": "A3", "pdf_path": "...", "ts": "...", "status": "processing"}
```

### attachments
```
attachments/
├─ raw_audio_xxx.m4a
├─ raw_pdf_yyy.pdf
└─ raw_image_zzz.jpg
```

---

## privacy グレード別パイプライン

| グレード | 暗号化 | AI 経路 | クラウド | 用途 |
|---|---|---|---|---|
| G0 公開 | 無 | ◎ | ◎ | ブログ素材 |
| G1 個人 | tag 付きのみ | opt-in | ◎ | 通常メモ |
| G2 研究 | 全部 | opt-in | △ | 未公開研究 |
| G3 機微 | 全部 | ✕ | ✕ | 医療・個人情報 |

L1-d（vault 単位）で実装。

---

## 論点 ID 一覧（このファイル）

- D1. scratch ノード形態
- D2. メタデータスキーマ
- D3. 添付保管
- D4. raw データ保持期間
- D5. workspace 選択
- D6. 直書き vs 別ストア
- D7. 設定永続化
- D8. capture 履歴ログ
- D9. 既存ツール互換
- D10. バックアップ
- L1. 暗号化必須範囲
- L2. AI 送信前検閲
- L3. クラウドリレー
- L4. URL 匿名化
- L5. アクセスログ
- L6. 忘れる権利
- L7. 共有 vault 帰属
- L8. AI 再現性

次ファイル `06_mvp_path.md` で MVP・横断観察・未決質問。

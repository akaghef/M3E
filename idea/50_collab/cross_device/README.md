# Cross Device / Mobile — PC 以外での M3E 体験

スマホ・タブレット・スマートウォッチなど PC 以外のデバイスで
**研究者 akaghef が M3E マップに触れる** 体験設計の網羅ブレスト。

現状 M3E は React+TS+SVG の PC ブラウザ前提（vault 同期と conflict_backup あり）。
そこに **どこから / 何で / どう触るか** を多軸に並べる。
採否は決めず、論点 ID 単位で後から選べる構造にする。

## 方針

- 採用判断はしない（F1-F6 全てに加え、派生サブ論点も並列）
- 実装は考えない（コンセプトと体験設計に集中）
- 複数案を比較表で並べる（特に **PWA / ネイティブ / WebView / 別アプリ** の4択）
- privacy 制約（policy_privacy）を全デバイスで意識
- 「閲覧」「編集」「捕捉」「通知」「読み上げ」を **別体験として分離可能** とみなす
- A9 モバイル共有シート（idea/capture_ingest）と相補的に
  → こちらは **閲覧・編集・通知・読み上げ全般**、capture_ingest は **入口に特化**

## ファイル構成

- [01_concept.md](01_concept.md) — なぜモバイル化か、ユースケース、capture_ingest との分担、現状制約
- [02_platform_options.md](02_platform_options.md) — PWA / ネイティブ / WebView / 別アプリ / レスポンシブ web の選択肢比較
- [03_runtime_modes.md](03_runtime_modes.md) — 体験モード列挙（閲覧/編集/捕捉/読み上げ/通知/手書き）
- [04_sync_offline.md](04_sync_offline.md) — オフライン同期・conflict_backup 連動・データモデル
- [05_mvp_path.md](05_mvp_path.md) — MVP 候補・段階導入・横断観察・未決質問

## 全体俯瞰 / 論点マップ

| 層 | 論点 | 扱うファイル |
|---|---|---|
| **Why** | PC で十分か、モバイル化の真の利得 | 01 |
| **Who/When** | 研究者が PC 以外で触りたいシーン | 01 |
| **Platform** | Pf1-Pf8: 配布形態の選択肢 | 02 |
| **Mode** | Md1-Md12: デバイス別の体験モード | 03 |
| **Sync** | Sy1-Sy10: オフライン・競合・vault 連動 | 04 |
| **MVP** | Mv1-Mv5: どこから始めるか | 05 |

## 論点一覧（早見表）

### Concept（01）
- Cn1. PC 体験を 100% 再現すべきか、別物として割り切るか
- Cn2. 「歩きながら」「電車で」「ベッドで」「実験室で」シーンの優先度
- Cn3. capture_ingest（A9）との重複と差別化
- Cn4. 研究者 1 名運用ゆえに **クロスデバイス同期** がユーザー要件か（複数人協調はまだ要らない）
- Cn5. PC 主・モバイル従の比率（90:10 / 70:30 / 50:50）

### Platform（02）
- Pf1. **PWA**（既存 web をインストール可能に）
- Pf2. **ネイティブ iOS/Android**（React Native / Flutter / Swift）
- Pf3. **WebView ラッパー**（Capacitor / Tauri Mobile）
- Pf4. **別アプリ**（capture/read 専用の薄いネイティブ）
- Pf5. **レスポンシブ web のまま**（追加配布なし）
- Pf6. **ショートカット / Siri Shortcuts / Tasker** などの軽量統合
- Pf7. **メール・iMessage・LINE 経由**（ゼロアプリ）
- Pf8. **電子書籍ビューア化**（マップを epub 化）

### Runtime Modes（03）
- Md1. **閲覧モード**（読み専用、ピンチ/パン最適化）
- Md2. **編集モード**（既存 UI を縮約、テキストのみ編集可）
- Md3. **capture モード**（F2 の専用入力 UI）
- Md4. **読み上げモード**（F4、TTS 連続再生）
- Md5. **通知モード**（F5、リマインド・タスク確認）
- Md6. **手書きモード**（F6、Pencil/Stylus）
- Md7. **検索モード**（マップ全文検索特化）
- Md8. **ロックスクリーン Widget / コントロールセンター**
- Md9. **「今日のノード」一画面表示**（ジャーナル風）
- Md10. **音声会話モード**（ヘッドホンで AI と対話、AlgLibMove 親和）
- Md11. **コーチ通知**（J5 メタ認知ログ + ウォッチ）
- Md12. **「マップを見せる」プレゼン補助**（学会・打ち合わせでスマホ片手）

### Sync / Offline（04）
- Sy1. オフライン編集 → 帰宅時 vault に sync
- Sy2. クラウドリレー（自前 vs Dropbox/iCloud/Drive）
- Sy3. P2P 同期（同 Wi-Fi）
- Sy4. 競合解決戦略（last-write-wins / merge / conflict_backup 流用）
- Sy5. 同期粒度（マップ全体 / scope 単位 / ノード単位）
- Sy6. 暗号化（policy_privacy）— モバイルストレージへの平文禁止
- Sy7. 同期方向（PC → mobile / 双方向 / mobile → PC のみ）
- Sy8. 帯域・電池・ストレージ制約
- Sy9. 「読むだけスナップショット」モード（編集不可で軽量）
- Sy10. workspace（vault）切替 UX のモバイル版

### MVP（05）
- Mv1. どの 1-2 シーンから始めるか
- Mv2. PWA か、レスポンシブ web で済むか
- Mv3. capture vs read どちらが先か
- Mv4. オフラインを最初から入れるか後回しか
- Mv5. ウォッチ・手書きは MVP 外でよいか

## キーメッセージ

1. **「PC 体験の縮小」と「モバイル専用体験」は別設計** — レスポンシブで終わると失敗する。
   モバイルは **Md3/Md4/Md5/Md10 の音声+通知+捕捉** に特化した別 UI を持つ価値がある。
2. **PWA が現状の最有力候補** — React+TS の web 資産を最大活用、配布審査回避、
   ただし iOS の PWA 制限（バックグラウンド・通知）が痛い。
3. **オフライン同期は「読み専用スナップショット」から始めるとリスク低** — 双方向同期は
   conflict_backup 流用でも複雑。Sy9 の片方向 read-only から段階導入。
4. **F4 読み上げモードは「移動中の研究」に強い** — 自分のマップを耳で聞ける化は他ツールに無い。
   AlgLibMove の認知層と接続すると「思考の伴侶」化する。
5. **手書き（F6）は別ブレスト推奨** — Pencil/Stylus 設計は深く、本ブレストでは
   位置づけだけ触り、深掘りは将来の `idea/handwriting/` に分離するのが筋。

## 関連 idea/ クロスリンク

- `idea/capture_ingest/` — A9 モバイル共有シート、本ブレストと相補
- `idea/keyboard_modes/` — Md2 編集モードの操作系参考（モバイルでは異なる）
- `idea/map_views/` — Md1 閲覧モードのビュー候補
- `idea/automation_obstacles/` — オフライン同期の自動化限界
- `idea/00_topic_pool.md` — F セクション（F1-F6）が本ブレストの起点

## 既存メモリ・ドキュメント・コードとの接続

- `project_overview` — React+TS+SVG。SVG はモバイルでも使えるがタッチ最適化必要
- `project_projection_vision` — 世界モデル→射影。**移動中の射影**（研究中ふと思いついたら即捕捉→帰宅で射影）
- `project_alglibmove_dogfood` — 認知層の不足。Md10 音声会話モードと接続
- `policy_privacy` — クライアント側暗号化必須。モバイルストレージは特に注意
- `vault_watch.ts` / `vault_path.ts` — 既存 vault 同期。Sy1/Sy7 の基盤
- `conflict_backup.ts` — Sy4 競合解決の流用元
- `feedback_dev_map_size` — モバイル表示は scope 切替で対応

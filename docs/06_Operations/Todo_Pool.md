# Todo Pool

## 目的

確定前の粗い TODO を一時プールし、正式タスク化前の取りこぼしを防ぐ。
**このファイルが TODO の正本**。他ファイルで TODO を管理しない。

## 運用ルール

1. 粗いメモでも登録してよい（未分解可）。
2. **TODO はこの 1 ファイルに集約する**。`backlog/` や `tomd` は LLM の思考プール専用で TODO は書かない。
3. 当日処理する課題は [TODO_today.md](TODO_today.md) にコピーして作業。完了したら Pool 側の State を更新。
4. 実施完了の詳細が継続運用に必要なら、該当する正本ドキュメントかマップ状態に反映する。
5. `Current_Status.md` には現在の重要項目のみ反映する。
6. 同じ項目が正式化されたら `Link` に反映先を記録する。

## 将来の構想
- LLM がマップに効率よくアクセスできるようになれば、TODO 自体をマップ上に移す検討をする（現状は Markdown 1 本運用）。

## 記法

- Date
- Topic
- Owner
- State (`pooled` | `ready` | `doing` | `blocked` | `done`)
- Link
- Note
- Priority (P1〜P5、P1 が最優先)

---

## ▶ Ready（着手可能・優先度順）

### P1: AkaghefAlgebra MATLAB→Julia 移植

- Date: 2026-04-15
- Topic: https://github.com/SSuzukiLab/AkaghefAlgebra を Julia に移植。M3E 上に構成ナレッジを階層的に落としてから作業
- Owner: akaghef
- State: ready
- Link: `backlog/2026-04-15-akaghef-algebra-port.md`
- Note: Core Principle 0（科学研究を主対象）に直接合致。研究データ本体は M3E 外に置きメタデータ+参照のみ（暫定）。粒度はファイル/アルゴリズム/関数/数式を階層で整理
- Priority: P1

---

### P1: AkaghefAlgebra 移植用 scope 設計（並走）

- Date: 2026-04-15
- Topic: `RESEARCH/MATLAB_Port/AkaghefAlgebra/` スコープを切って modules/dependencies/math/port_plan を構成
- Owner: akaghef
- State: ready
- Link: `backlog/2026-04-15-akaghef-algebra-port.md`
- Note: Core Principle 2（認知境界としての scope）の dogfooding。移植作業で scope 境界の痛みを記録→スコープビュー要件定義に活用
- Priority: P1

---

### P1: Team Collaboration Phase 2

- Date: 2026-04-08
- Topic: Collab Phase 2 — conflict backup + エンティティ一覧 UI + 監査ログ
- Owner: -
- State: ready
- Link: `docs/03_Spec/Team_Collaboration.md` (Phase 2)
- Note: Phase 1 完了（entity/lock/SSE/push 15 tests pass）。次は堅牢化。conflict backup の退避・復元、誰がどの scope にいるかの UI、操作ログ

---

### P1: Cloud Sync 競合 UI 改善

- Date: 2026-04-08
- Topic: T4 — Cloud Sync conflict 時の diff 表示 + 確認ダイアログ
- Owner: visual
- State: ready
- Link: `docs/tasks/handoff_cloud_sync_conflict_ui.md`
- Note: visual にハンドオフ済み。ヒアリングセッションで詳細を詰めてから着手

---

### P2: CI Stage A

- Date: 2026-04-07
- Topic: CI Stage A の最小ジョブ実装（branch-role ゲート統合）
- Owner: -
- State: ready
- Link: `docs/06_Operations/Test_and_CICD_Guide.md`
- Note: PR 前ゲートとして運用。`npm run build` + `node --test` を CI で回す最小構成

---

### P2: scope/alias 仕様拡張

- Date: 2026-04-07
- Topic: scope/alias 仕様を Beta 実装粒度に拡張
- Owner: -
- State: ready
- Link: `docs/03_Spec/Scope_and_Alias.md`
- Note: delete/権限/同一scope制約の訂正と Beta 実装仕様化。Collab の scope lock と整合が必要

---

### P3: Linear↔Tree L1

- Date: 2026-04-07
- Topic: Linear↔Tree L1 最小実装と round-trip テスト
- Owner: -
- State: ready
- Link: `docs/03_Spec/Linear_Tree_Conversion.md`
- Note: L1 インデント形式の export/import を可逆にする

---

### P3: parser/reconcile テスト

- Date: 2026-04-07
- Topic: parser/reconcile 回帰テスト追加
- Owner: -
- State: ready
- Link: `docs/03_Spec/Linear_Tree_Conversion.md`
- Note: Linear 変換 UI の誤変換防止

---

### P3: MCP 実運用テスト

- Date: 2026-04-07
- Topic: MCP サーバー経由の LLM 連携パイプラインの実運用テスト
- Owner: manager
- State: ready
- Link: `docs/03_Spec/REST_API.md` (LLM 連携セクション)
- Note: m3e_mcp_server.py を Claude Desktop に登録し、実際のノード操作を検証

---

## ⏸ Blocked（判断待ち）

### セキュリティ検討（4件 — Owner: akaghef が判断）

- Date: 2026-04-08
- Topic: Collab API セキュリティ一括検討
- Owner: akaghef
- State: blocked
- Link: `docs/03_Spec/Team_Collaboration.md` (セキュリティ検討事項)
- Note: 以下4点をまとめて判断する
  1. **CSRF**: カスタムヘッダー `X-M3E-Token` で十分か
  2. **LAN 露出**: 127.0.0.1 バインド維持 or LAN 公開時の認証・暗号化
  3. **エージェント偽装**: トークン有効期限、revocation API の要否
  4. **入力バリデーション**: scope push の部分 validate 方式

---

### Rapid 操作性調整

- Date: 2026-04-07
- Topic: Rapid 操作性調整
- Owner: -
- State: blocked
- Link: `docs/03_Spec/Band_Spec.md`
- Note: 操作性改善は beta 側で継続する。旧 mvp ディレクトリは削除済み

---

## 📦 Pooled（未整理）

- Date: 2026-04-15
- Topic: 研究データ管理方針の確定（M3E 外に置くが「アクセス時に見える」リスク経路を特定）
- Owner: akaghef
- State: pooled
- Link: `backlog/2026-04-15-akaghef-algebra-port.md`
- Note: 懸念経路候補: キャッシュ / ログ / cloud sync / プレビュー。AkaghefAlgebra 移植 1 サイクル回してから判断

---

- Date: 2026-04-15
- Topic: Flash モード最小実装（簡易テキストボックスで思いつきプール）
- Owner: -
- State: pooled
- Link: `docs/03_Spec/Band_Spec.md`
- Note: DEV/Vision の Flash band に合致するが Core Principles の「汎用メモ整理より研究思考」から見ると優先度低。backlog md で当面代用

---

- Date: 2026-04-15
- Topic: スコープビュー実装
- Owner: visual
- State: pooled
- Link: `docs/03_Spec/Scope_Transition.md`
- Note: Rapid band 中核機能。AkaghefAlgebra 移植中の要件抽出後に着手

---

- Date: 2026-04-15
- Topic: インストーラーバグ修正（友人配布ブロッカー）
- Owner: -
- State: pooled
- Link: -
- Note: 既知バグあり要特定。Core Principle 6（消失バグゼロ優先）に関わる部分のみ優先、配布ニーズは Core の「初期マルチユーザー最適化は反対側」と衝突するため後回し可

---

- Date: 2026-04-13
- Topic: API コール効率化（回数・コスト削減）
- Owner: -
- State: pooled
- Link: -
- Note: 対象エンドポイント／頻度の洗い出しから。バッチング／キャッシュ／差分同期が候補

---

- Date: 2026-04-13
- Topic: HOME スコープ機能の実装
- Owner: -
- State: pooled
- Link: `docs/design/scope-tree-as-system.md`
- Note: HOME が他スコープに対してどう振る舞うか要定義

---

- Date: 2026-04-13
- Topic: ドキュメント名の明示表示
- Owner: visual
- State: pooled
- Link: -
- Note: UI 上で埋もれている。ヘッダー／タブ／ブレッドクラムのどれかは要検討

---

- Date: 2026-04-07
- Topic: Rapid 操作性調整（Band_Spec 連動）
- Owner: visual
- State: pooled
- Link: `docs/03_Spec/Band_Spec.md`
- Note: 旧 mvp は削除済み。beta 側で継続

---

- Date: 2026-04-07
- Topic: Visual polish（spacing, edge curvature, selected-state contrast, long text）
- Owner: visual
- State: pooled
- Link: -
- Note: todo_by_role.md から統合

---

- Date: 2026-04-07
- Topic: Fit-to-content / Focus-selected アクション実装
- Owner: visual
- State: pooled
- Link: -
- Note: P4

---

- Date: 2026-04-07
- Topic: 帯域切り替え UI（Flash/Rapid/Deep）
- Owner: visual
- State: pooled
- Link: `docs/03_Spec/Band_Spec.md`

---

- Date: 2026-04-07
- Topic: 重要度ビュー実装
- Owner: visual
- State: pooled
- Link: -

---

- Date: 2026-04-07
- Topic: reparent UI 改善（ドロップターゲットハイライト + 拒否メッセージ）
- Owner: visual
- State: pooled
- Link: -

---

- Date: 2026-04-07
- Topic: ViewState と PersistedDocument の完全切り離し
- Owner: data
- State: pooled
- Link: -

---

- Date: 2026-04-07
- Topic: 具象軸（抽象ノード↔具象ノード）をモデルに組み込む
- Owner: data
- State: pooled
- Link: -

---

- Date: 2026-04-07
- Topic: Imported metadata レンダリング（メタ情報を UI へ）
- Owner: data
- State: pooled
- Link: -

---

- Date: 2026-04-07
- Topic: Flash 実装（data 層: データ構造・永続化 / visual 層: レンダリング・インタラクション）
- Owner: data + visual
- State: pooled
- Link: `docs/03_Spec/Band_Spec.md`

---

- Date: 2026-04-07
- Topic: AI コマンド操作インターフェース設計
- Owner: data
- State: pooled
- Link: `docs/03_Spec/AI_Common_API.md`

---

- Date: 2026-04-07
- Topic: AI integration 基盤設計（オフライン優先）
- Owner: data
- State: pooled
- Link: `docs/04_Architecture/AI_Infrastructure.md`

---

- Date: 2026-04-07
- Topic: Local/Cloud データ同期（HTTPS+Bearer, E2E 暗号化）
- Owner: data
- State: pooled
- Link: `docs/03_Spec/Cloud_Sync.md`
- Note: P1。送受信 E2E 暗号化

---

- Date: 2026-04-07
- Topic: 同期用 E2E 暗号化（AES-256-GCM、~/.m3e/sync.key）
- Owner: data
- State: pooled
- Link: -
- Note: Node.js 組み込み crypto のみ。PUT 前に暗号化・GET 後に復号

---

- Date: 2026-04-07
- Topic: delete confirmation（非葉ノード削除時の確認 UI）
- Owner: data
- State: pooled
- Link: -

---

- Date: 2026-04-07
- Topic: Claude Desktop 連携の AI agent 役割設定（news fetch / AI manager / security manager）
- Owner: akaghef（承認）
- State: pooled
- Link: `docs/tasks/` (旧 todo_by_role.md 由来)
- Note: privacy 方針決定後に security manager 設計

---

- Date: 2026-04-02
- Topic: デモ版ローンチ準備（aircraft.mm / demo JSON クリーンレンダー確認、スタートアップパッケージ）
- Owner: claude
- State: pooled
- Link: -

---

- Date: 2026-04-02
- Topic: 日常使用ローンチ（Beta を毎日使える状態に）
- Owner: claude
- State: pooled
- Link: -
- Note: P1（todo_by_role 由来）

---

- Date: 2026-04-07
- Topic: コード内 TODO: `scripts/final/migrate-from-beta.bat` L80 — schema 変更時に migrate.js を呼ぶ
- Owner: -
- State: pooled
- Link: `scripts/final/migrate-from-beta.bat`

---

- Date: 2026-04-07
- Topic: MCP ツールに alias / GraphLink / nodeType 変更を追加
- Owner: -
- State: pooled
- Link: -
- Note: 現在の MCP ツールは text の CRUD のみ。scope/alias の Beta 実装後に合わせて拡張

---

- Date: 2026-04-07
- Topic: Gateway policy Phase 2 実装（LiteLLM 統合）
- Owner: -
- State: pooled
- Link: `docs/04_Architecture/AI_Infrastructure.md`
- Note: 設計済み・未実装。Phase 1（直接呼び出し）は動作中

---

## ✅ Done（直近のみ保持、古いものは daily に委譲）

- Date: 2026-04-08
- Topic: Team Collaboration Phase 1 実装
- State: done
- Note: entity/auth/lock/SSE/scope-push 完了。collab.ts + 15 tests pass

---

- Date: 2026-04-08
- Topic: main マージ + vYYMMDD タグ付与
- State: done
- Note: v260408 + v260408-2 完了

---

- Date: 2026-04-07
- Topic: REST API 仕様書の作成
- State: done
- Note: Document API / Cloud Sync API / LLM 連携の全エンドポイントを文書化

---

- Date: 2026-04-02
- Topic: 運用文書の責務分離
- State: done
- Note: Documentation_Rules.md 策定。260407 時点で運用定着確認

# Akaghef DB / Cloud Sync タスクチェックリスト

最終更新: 2026-04-10

---

## 今日やること（友達配布前）

### Supabase ゴミデータ掃除

- [ ] **Supabase の `documents` テーブルからテスト行を削除する**
  - 理由: 開発中に `rapid-main` や `akaghef-beta` などの ID でゴミデータが溜まっている
  - 方法: Supabase Dashboard > Table Editor > `documents` を開き、全行を DELETE。または SQL Editor で `DELETE FROM public.documents;`
  - 本番利用前に綺麗にしておかないと、将来 pull 時にゴミが降ってくる

- [ ] **`rapid-main` doc ID を完全に廃止する**
  - 理由: commit `30a0dad` で「akaghef-beta に統一」としたが、`start_viewer.ts` のサーバー側にまだ `"rapid-main"` が 6箇所残っている（行 925, 952, 962, 1056, 1074, 1081）
  - 方法: これはコード変更が必要。Akaghef が直接やるか、エージェントに依頼する
  - 影響: Cloud Sync の auto-sync が `rapid-main` で push するため、Supabase 側に `rapid-main` 行ができてしまう

### 配布パッケージの確認

- [ ] **`.env` が配布物に含まれないことを確認する**
  - 理由: `.env` には `M3E_SUPABASE_URL` と `M3E_SUPABASE_ANON_KEY` が入っている。友達に渡すパッケージに混入すると Akaghef の Supabase にアクセスされる
  - 方法: `.gitignore` に `beta/.env` は既にあるので Git 経由では安全。配布 zip を手動で作る場合は `.env` を除外すること
  - install/windows/ のスクリプトは `.env` を参照しない（環境変数は `m3e.conf` で管理）ので OK

- [ ] **`M3E_CLOUD_SYNC` 未設定で正常起動するか確認する**
  - 理由: 友達の環境には `.env` がないので、Cloud Sync は自動で disabled になるはず
  - 方法: `beta/.env` をリネームして起動テスト → `node dist/node/start_viewer.js` → viewer が開けば OK
  - コード確認済: `loadCloudSyncConfig()` は `M3E_CLOUD_SYNC !== "1"` なら `{ enabled: false }` を返す。Sync API も 503 ではなく status で `enabled: false` を返すので UI も壊れない

- [ ] **install/windows/ のスクリプトが動くか確認する**
  - 理由: 友達はこのスクリプトで M3E をインストール・起動する
  - 方法: `setup.bat` を実行 → `launch.bat` を実行 → viewer が開くか確認
  - 注意: `common_env.bat` は `%LOCALAPPDATA%\M3E` にデータフォルダを作る。Node.js ランタイムは `payload/runtime/` に同梱する必要がある

- [ ] **配布 zip の中身リスト**
  - `install/windows/` 一式
  - `payload/runtime/node.exe` (Node.js バイナリ)
  - `payload/app/` (ビルド済み `dist/` + `node_modules/`)
  - `.env` は含めない
  - `beta/data/` は含めない（ユーザーごとに `%LOCALAPPDATA%\M3E\data` に生成される）

---

## 将来やること（クラウドローンチ前）

### 優先度: 高（ローンチ必須）

1. **RLS ポリシーを本番用に差し替える**
   - 理由: 現在は `anon` ロールに全権限がある（開発用）。本番では認証済ユーザーだけがアクセスすべき
   - 方法: `supabase_schema.sql` の「3b. anon (development only)」セクション 4つの policy を DROP する
   - `DROP POLICY "Anon can read documents" ON public.documents;` (以下同様)

2. **`owner_id` カラムを追加してマルチテナント化する**
   - 理由: 現在は全ユーザーが全ドキュメントを読み書きできる。ユーザーごとにデータを分離する必要がある
   - 方法:
     ```sql
     ALTER TABLE public.documents ADD COLUMN owner_id uuid REFERENCES auth.users(id);
     CREATE INDEX idx_documents_owner ON public.documents(owner_id);
     ```
   - RLS を `using (auth.uid() = owner_id)` に変更

3. **Supabase Auth を設定する**
   - 理由: `owner_id` による RLS を効かせるには認証が必要
   - 方法: Supabase Dashboard > Authentication > Providers から Email/Password を有効化。クライアント側 (`viewer.ts`) にログイン UI を追加
   - 最初は Email + Password だけで十分。Google OAuth は後でもよい

4. **本番環境と開発環境を分離する**
   - 理由: 開発中のデータと本番データが混在するとリスクが高い
   - 方法: Supabase プロジェクトを 2つ作る（`m3e-dev` / `m3e-prod`）。`.env.development` と `.env.production` に分ける
   - または Supabase の Branch 機能（Pro プラン）を使う

### 優先度: 中（ユーザー増加時）

5. **Supabase プラン選定**
   - Free プラン: 500MB DB, 1GB Storage, 50K MAU — 友達数人なら十分
   - Pro プラン ($25/月): 8GB DB, 100GB Storage, 100K MAU — 10人以上のユーザーが使うなら
   - 判断基準: ドキュメント数 x 平均サイズ で DB 容量を見積もる。M3E の 1ドキュメントは JSON で数 KB〜数百 KB なので、Free で数百ドキュメントは余裕

6. **Cloud Sync の自動バックアップ設定**
   - Supabase の Point-in-Time Recovery (Pro プラン) を有効にする
   - または定期的に `pg_dump` でバックアップ

7. **Realtime Subscriptions の検討**
   - 現在のスキーマで `supabase_realtime` に documents テーブルを追加済み
   - 将来的にブラウザ間リアルタイム同期をクラウド経由でやる場合に使う
   - 今は SSE ベースの collab で十分

### 優先度: 低（スケール時）

8. **ドキュメントの state カラムの肥大化対策**
   - `state` は JSONB で丸ごと保存。ノード数が増えると数 MB になる可能性
   - 差分同期（CRDT or OT）を検討。または state を分割して保存

9. **API Rate Limiting**
   - Supabase の Edge Functions + rate limit middleware を追加
   - Free プランのリクエスト制限に引っかかる前に対策

---

## 現在のアーキテクチャまとめ

```
M3E_CLOUD_SYNC=1 かつ M3E_CLOUD_TRANSPORT=supabase の場合のみ Supabase に接続
  → .env に M3E_SUPABASE_URL, M3E_SUPABASE_ANON_KEY が必要
  → 未設定なら完全にローカルのみで動作（Cloud Sync disabled）

ローカル DB: SQLite (M3E_dataV1.sqlite)
  → install 時に %LOCALAPPDATA%\M3E\data\ に作成
  → Cloud Sync とは独立して常に動作する

Cloud Sync Transport:
  - FileTransport: ローカルファイルにミラー（テスト用）
  - SupabaseTransport: Supabase の documents テーブルに push/pull
```

## 既知の問題

- `start_viewer.ts` でサーバー側の doc ID が `"rapid-main"` のままハードコードされている（6箇所）
  - auto-sync, audit log, presence が全て `rapid-main` を使っている
  - ブラウザ側 (`viewer.ts`) は `akaghef-beta` がデフォルト
  - このズレがあると Cloud Sync で別々の行に書き込まれる

# Performance / Scale — 巨大マップ・横断検索・オフライン優先

M3E が「個人の長期世界モデル」になっていく過程で避けられない
**規模の壁**（10000+ ノード、複数マップ、長期履歴）を、
採否を決めずに複数案で並べるブレスト。

現状: SVG レンダリングで 1 マップ数百ノード規模で稼働。
DEV map ~50-300 ノード運用、scope param で部分表示で凌いでいる
（feedback_dev_map_size）。
半年で「世界モデル→射影」実用化を狙う以上
（project_projection_vision）、年内のどこかで巨大マップは現実になる。

## 方針

- 採用判断はしない（M1-M5 全てに加え、派生サブ論点も並列）
- 実装は考えない（コード片は MVP ファイルで参考程度のみ）
- 比較表を多用（特にレンダリング方式・検索バックエンド・同期戦略）
- 既存 vault / scope / cloud_sync / conflict_backup と接続できる形で書く
- 「研究者 1 名運用」の特性を前提に（複数人協調はまだ要らない）
- 「研究者の生涯マップ」想定で 10 年スパンの劣化シナリオも想像する

## ファイル構成

- [01_concept.md](01_concept.md) — なぜ性能/スケールか、痛みのシーン、現状制約
- [02_rendering_strategies.md](02_rendering_strategies.md) — M1: 10k+ ノード描画の選択肢（仮想化/LOD/Canvas/WebGL）
- [03_cross_map_search.md](03_cross_map_search.md) — M2 + M4: 複数マップ統合検索と長期履歴インデックス
- [04_workspace_navigation.md](04_workspace_navigation.md) — M3: ワークスペース横断ナビ UX
- [05_cache_offline.md](05_cache_offline.md) — M5: キャッシュ・オフライン優先・IndexedDB 戦略
- [06_mvp_path.md](06_mvp_path.md) — MVP 候補・段階導入・横断観察・未決質問

## 全体俯瞰 / 論点マップ

| 層 | 論点 | 扱うファイル |
|---|---|---|
| **Why** | スケール痛が出るシーンと「いつ爆発するか」 | 01 |
| **Render** | Rd1-Rd12: 描画方式の選択肢 | 02 |
| **Search** | Sr1-Sr14: 検索バックエンド/インデックス/UX | 03 |
| **Nav** | Nv1-Nv10: workspace 切替・横断ナビ UX | 04 |
| **Cache** | Ch1-Ch12: 永続層・オフライン・同期 | 05 |
| **MVP** | Mv1-Mv6: どこから始めるか | 06 |

## 論点一覧（早見表）

### Concept（01）

- Cn1. **痛みはいつ来るか** — 数百→数千→数万の各段階で何が壊れるか
- Cn2. **誰の痛みか** — akaghef 自身の長期マップ vs 公開マップ vs 多人数
- Cn3. **scope 運用で十分逃げ切れるか** — feedback_dev_map_size の延命限界
- Cn4. **「巨大マップは健全か」哲学的問** — そもそも分割すべきという価値観
- Cn5. **性能投資の機会費用** — B1 論文生成・C1 Devil's Advocate と比べてどうか
- Cn6. **ベンチマーク基準** — 60fps / 30fps / 「触れる」だけ、どれを目指すか

### Rendering Strategies（02）

- Rd1. **SVG 全描画**（現状）— シンプル、CSS/text 流用、~1000 ノードで限界
- Rd2. **SVG + viewport カリング** — 画面外を描かない、最も低リスク
- Rd3. **SVG + LOD**（Level of Detail）— ズームレベルで詳細を切替
- Rd4. **Canvas 2D 全描画** — 高速だがイベント処理を自作
- Rd5. **Canvas + SVG ハイブリッド** — Canvas で大量 / SVG で操作対象
- Rd6. **WebGL（PixiJS / regl）** — 数万ノード可能、学習コスト高
- Rd7. **DOM 仮想化**（react-window 風）— リスト的ビューには有効、グラフには不向き
- Rd8. **クラスタリング** — ズームアウト時に近傍ノードを 1 個に集約
- Rd9. **段階ロード** — 起点ノードから N hop だけ展開
- Rd10. **WebWorker でレイアウト計算** — 描画と分離
- Rd11. **OffscreenCanvas** — Worker 内で描画完結
- Rd12. **物理エンジン分離**（P1 接続）— d3-force を WASM 化

### Cross-Map Search & History Index（03）

- Sr1. **全マップを 1 インデックスに** — グローバル検索体験
- Sr2. **マップごとインデックス + 串刺しクエリ** — 分離保てる
- Sr3. **client-side fuzzy**（Fuse.js / MiniSearch）— 数千行まで実用
- Sr4. **client-side embedded**（SQLite WASM / DuckDB WASM）— 数万行まで
- Sr5. **server-side インデックス**（local node プロセス）— 既存 rapid_mvp 拡張
- Sr6. **semantic search**（embedding）— LLM 接続必須、L5 検閲と接続
- Sr7. **増分インデックス**（vault_watch 連動）— 起動時 full scan を回避
- Sr8. **検索 UI**: グローバルバー / Cmd-P / マップ内 inline / 専用画面
- Sr9. **検索結果の表示**: ジャンプ / 並列ペイン / preview tooltip
- Sr10. **history インデックス**: backup.ts のスナップショット横断検索
- Sr11. **「いつ書いたか」軸** — created/updated 時刻での絞り込み
- Sr12. **「どの workspace で」軸** — vault 横断
- Sr13. **検索クエリ言語**: 自然文 / 演算子付き / 構造クエリ（タグ:〜 親:〜）
- Sr14. **ヒット率改善学習** — クリックされたノードを上位に

### Workspace Navigation（04）

- Nv1. **最近の workspace リスト**（MRU）
- Nv2. **ピン留め workspace**
- Nv3. **workspace 検索**（名前 + 説明）
- Nv4. **workspace のサムネイル**（マップ俯瞰画像）
- Nv5. **workspace タブバー**（ブラウザ風）
- Nv6. **command palette からの切替**（Cmd-K → 候補）
- Nv7. **workspace + scope の合成 URL**（既存の ws/map/scope 統合済）
- Nv8. **history 戻る/進む**（ブラウザ的）
- Nv9. **ブックマーク（任意 scope を 1 クリックで開く）**
- Nv10. **workspace タグ / ジャンル分類**（research / personal / dev / archive）

### Cache / Offline（05）

- Ch1. **オフライン優先設計** — local が真、cloud は補助
- Ch2. **IndexedDB を一次ストレージ化**
- Ch3. **vault と IndexedDB の二層**（既存）
- Ch4. **ServiceWorker キャッシュ** — viewer asset と API レスポンス
- Ch5. **scope 単位の遅延ロード**
- Ch6. **lazy thumbnail / preview**
- Ch7. **書き込みキュー**（オフライン中の編集をバッファ）
- Ch8. **競合解決の自動化レベル**（UI 提示 / 自動 merge / conflict_backup ファイル）
- Ch9. **暗号化と同期の順序**（policy_privacy 準拠）
- Ch10. **キャッシュ容量管理**（LRU / 明示 evict）
- Ch11. **「ローカル節約モード」** — 全文ではなく要約のみ持つ
- Ch12. **PWA manifest 化**（cross_device F2 と接続）

### MVP（06）

- Mv1. どの 1-2 痛みから始めるか
- Mv2. Render は viewport カリング 1 個でどこまで延命できるか
- Mv3. Search は client-side fuzzy 起点でよいか
- Mv4. Cache は ServiceWorker から入るか IndexedDB から入るか
- Mv5. workspace nav は MRU + Cmd-K だけで足りるか
- Mv6. ベンチマーク自動化を MVP に入れるか後回しか

## キーメッセージ

1. **「全部一気に直す」は失敗パターン** — render / search / nav / cache は
   性能特性が異なるので、痛みが出た順に 1 軸ずつ手当てするのが筋。
2. **scope 運用は延命策、根本解決ではない** — 半年で 10k ノード級に達する
   シナリオが現実なら、Rd2 viewport カリング + Sr3 client fuzzy の
   2 点を先に整えるべき。
3. **「研究者の生涯マップ」を想定するなら history インデックスが効く** — backup.ts の
   スナップショットは資産。Sr10 は他ツールとの差別化要因にもなる。
4. **オフライン優先は privacy と相性が良い** — policy_privacy が
   「機微情報をクラウドに置けない」を要求するため、Ch1-Ch3 の
   IndexedDB 一次化はそもそも必須。
5. **WebGL/WASM の学習コストは過大評価されがち** — 数万ノード以上を本気で
   扱うなら不可避だが、それより前にやるべき低コスト案（Rd2/Rd8/Rd9）が
   多数ある。先にそれらを枯らしてから検討。

## 関連 idea/ クロスリンク

- `idea/cross_device/` — Pf1 PWA / Sy1-Sy10 同期と本ブレストの Ch1-Ch12 が重複
- `idea/maintenance_hygiene/` — 重複検出（D1）が走る基盤として検索インデックスが必要
- `idea/time_history/` — Sr10 の history インデックスは I1 time travel と直結
- `idea/automation_obstacles/` — workspace 横断ナビは自動化の限界点を含む
- `idea/00_topic_pool.md` — M セクション（M1-M5）が本ブレストの起点

## 既存メモリ・ドキュメント・コードとの接続

- `project_overview` — React+TS+SVG。SVG が制約源そのもの
- `project_projection_vision` — 半年で実用化。性能投資 vs 機能投資の優先度判断必要
- `project_alglibmove_dogfood` — 認知層が無いので「巨大マップを賢く扱う」は AI 接続前提
- `feedback_dev_map_size` — 50-300 ノード運用 / scope 切替の延長線
- `policy_privacy` — Ch1 オフライン優先設計の動機の半分
- `beta/src/node/rapid_mvp.ts` — サーバー側インデックスを置く場所候補
- `beta/src/node/cloud_sync.ts` — 既存の同期実装、Ch3/Ch7 の起点
- `beta/src/node/conflict_backup.ts` — Ch8 の起点
- `beta/src/node/backup.ts` — Sr10 history インデックスの起点
- `beta/src/shared/scope_types.ts` — Ch5 scope 単位ロードの基盤
- `beta/src/browser/viewer.ts`（7800 行）— Rd1-Rd12 の手当て対象

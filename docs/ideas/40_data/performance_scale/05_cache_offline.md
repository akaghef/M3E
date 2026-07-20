# 05. Cache / Offline — キャッシュ・オフライン優先・IndexedDB 戦略

M5「キャッシュ／オフライン優先」を網羅。
policy_privacy「クラウドに平文置けない」を背景に、
**ローカル一次・クラウド補助** の設計選択肢を並べる。

## 0. 議論の前提

- 既存の永続層: vault（ローカル .md/.json）
- 既存の同期: cloud_sync.ts、conflict_backup.ts
- ブラウザ運用: vault と直接やり取りするのは node サーバー（rapid_mvp.ts）
- PWA 化は cross_device で並行検討中
- backup.ts によるスナップショット履歴あり

## 1. Ch1: オフライン優先設計（philosophical）

| 項目 | 内容 |
|---|---|
| 概要 | local が真実、cloud は補助。逆ではない |
| 良い点 | privacy 適合、ネット切断耐性、低レイテンシ |
| 悪い点 | 多デバイス同期の複雑性 |
| 推し度 | ★★★（前提条件） |

派生:
- Ch1.1 完全 local-first（cloud 一切使わない）
- Ch1.2 local 一次 + cloud バックアップ
- Ch1.3 local 一次 + cloud 同期（双方向）
- Ch1.4 ハイブリッド（機微 local / 公開 cloud）

## 2. Ch2: IndexedDB を一次ストレージ化

| 項目 | 内容 |
|---|---|
| 概要 | ブラウザ IndexedDB をマップの一次永続層に |
| 良い点 | オフライン完結、サーバー依存削減、PWA 化に必須 |
| 悪い点 | 既存 vault との二重管理、quota 制約 |
| 推し度 | ★★★（PWA 化前提なら必須） |

派生:
- Ch2.1 IDB のみ（vault は export 用）
- Ch2.2 IDB + vault 同期（vault が真実）
- Ch2.3 IDB が真実 + vault は backup
- Ch2.4 IDB は cache 層のみ（vault に都度問合せ）

## 3. Ch3: vault と IndexedDB の二層

| 項目 | 内容 |
|---|---|
| 概要 | 現状の延長。vault が永続、IDB を high-speed cache に |
| 良い点 | 既存運用を壊さない、オフライン部分対応 |
| 悪い点 | 二層整合性、cache invalidation 問題 |
| 推し度 | ★★★（現実的な MVP） |

派生:
- Ch3.1 IDB は read cache のみ（write は vault 直）
- Ch3.2 IDB は write-through（並行）
- Ch3.3 IDB は write-back（遅延 flush）
- Ch3.4 「scope ごと」cache（読み込んだ scope だけ IDB に置く）

## 4. Ch4: ServiceWorker キャッシュ

| 項目 | 内容 |
|---|---|
| 概要 | viewer asset・API レスポンスを SW で intercept キャッシュ |
| 良い点 | オフライン起動可能、リロード爆速 |
| 悪い点 | デバッグ困難、更新タイミング厄介 |
| 推し度 | ★★★（PWA 化のセット） |

派生:
- Ch4.1 静的 asset のみ（cache-first）
- Ch4.2 API レスポンスもキャッシュ（stale-while-revalidate）
- Ch4.3 ノード単位の API キャッシュ
- Ch4.4 「最後に見た状態」を即時表示

## 5. Ch5: scope 単位の遅延ロード

| 項目 | 内容 |
|---|---|
| 概要 | 全マップを読み込まず、現在表示中の scope だけロード |
| 良い点 | 初期表示高速、メモリ消費抑制 |
| 悪い点 | scope 切替時の追加ロード待ち |
| 推し度 | ★★★（既存 scope 基盤を活用） |

派生:
- Ch5.1 scope ごとに別 IDB key
- Ch5.2 prefetch（隣接 scope を裏で読む）
- Ch5.3 「最近使った scope」を常時メモリ保持
- Ch5.4 LRU で scope を evict

## 6. Ch6: lazy thumbnail / preview

| 項目 | 内容 |
|---|---|
| 概要 | サムネ・プレビューは要求された時に生成 |
| 良い点 | 起動コスト下げる |
| 悪い点 | 初回表示遅延 |
| 推し度 | ★★（Nv4 と接続） |

## 7. Ch7: 書き込みキュー（オフライン中のバッファ）

| 項目 | 内容 |
|---|---|
| 概要 | オフライン中の編集を queue、復帰時に flush |
| 良い点 | 完全オフライン編集可能 |
| 悪い点 | 順序保証・競合解決の複雑性 |
| 推し度 | ★★★（cross_device オフライン編集の前提） |

派生:
- Ch7.1 操作ログ方式（CRDT 的）
- Ch7.2 最終状態方式（last-write-wins）
- Ch7.3 patch 方式（差分のみ送信）
- Ch7.4 ハイブリッド（基本 patch、衝突時は最終状態 prompt）

## 8. Ch8: 競合解決の自動化レベル

| 案 | 概要 | UX |
|---|---|---|
| Ch8.1 全自動 LWW | last-write-wins | 「気づかぬうちに上書き」のリスク |
| Ch8.2 全自動 merge | 構造的 merge を試みる | 失敗時にだけ介入 |
| Ch8.3 conflict_backup | 既存方式（衝突したら別ファイル） | 後で手動マージ |
| Ch8.4 inline diff UI | UI で差分提示、ユーザー選択 | 集中阻害だが安心 |
| Ch8.5 3-way merge UI | git mergetool 風 | 重い |

→ MVP は **Ch8.3 既存方式の継続** が無難。
  Ch8.2 自動 merge は CRDT 採用次第。

## 9. Ch9: 暗号化と同期の順序

policy_privacy 準拠の必須要件。

- Ch9.1 平文 IDB → 暗号化 vault 同期
- Ch9.2 暗号化 IDB → 暗号化 vault（端末紛失耐性）
- Ch9.3 暗号化 cloud → 平文 IDB（ローカルだけ平文）
- Ch9.4 ノード単位選択暗号化（L1 と接続）

→ 「ローカル平文 / クラウド暗号化」が現実解。
  端末暗号化（OS フルディスク）に依存。

## 10. Ch10: キャッシュ容量管理

| 項目 | 内容 |
|---|---|
| 概要 | IDB quota（数百 MB〜数 GB）の管理 |
| 良い点 | 巨大 vault を持っても破綻しない |
| 悪い点 | evict されたデータの再ロード |

派生:
- Ch10.1 LRU 自動 evict
- Ch10.2 「最近見ていない workspace を evict」
- Ch10.3 容量警告（80% で notify）
- Ch10.4 手動 evict UI（「この workspace を local から消す」）

## 11. Ch11: 「ローカル節約モード」

| 項目 | 内容 |
|---|---|
| 概要 | 全文ではなく要約・タイトル・構造のみを local に保持 |
| 良い点 | サイズ激減、検索・ナビは可能 |
| 悪い点 | 詳細閲覧時に full load 待ち |
| 推し度 | ★★（モバイル / 古い workspace 向け） |

派生:
- Ch11.1 タイトルのみ
- Ch11.2 タイトル + 1 行要約
- Ch11.3 構造のみ（テキスト無し）
- Ch11.4 「閲覧したノードだけ詳細キャッシュ」

## 12. Ch12: PWA manifest 化

| 項目 | 内容 |
|---|---|
| 概要 | manifest.json + SW で「アプリ化」 |
| 良い点 | OS インストール、起動高速、オフライン対応 |
| 悪い点 | iOS 制限、配布審査回避できるが UX 制約 |
| 推し度 | ★★（cross_device の主案 Pf1 と統合） |

## 13. 比較サマリー: 一次ストレージ選択

| 案 | privacy | offline | 既存破壊 | 推し度 |
|---|---|---|---|---|
| Ch1.1 完全 local-first | ◎ | ◎ | 中 | ★★ |
| Ch1.2 local + cloud backup | ◎ | ◎ | 小 | ★★★ |
| Ch1.3 local + cloud sync | ○ | ○ | 中 | ★★ |
| Ch2.1 IDB のみ | ◎ | ◎ | 大 | ★ |
| Ch3.1 IDB read cache | ◎ | △ | 小 | ★★★ |
| Ch3.3 IDB 真実 + vault backup | ○ | ◎ | 大 | ★★ |

→ 推し: **Ch1.2 + Ch3.1** の組み合わせ（local-first + IDB read cache）。
  PWA 化は Ch3.3 への昇格を要するが段階導入可。

## 14. 同期の方向性

| 方向 | シナリオ | 推し |
|---|---|---|
| PC ↔ PC | 複数 PC 利用 | ★★★ |
| PC → mobile（read） | 出先で閲覧 | ★★★ |
| mobile → PC | 出先で書く | ★★ |
| 双方向（PC ↔ mobile） | 完全同期 | ★★ |

→ MVP は「PC ↔ PC」と「PC → mobile read-only snapshot」が現実的。

## 15. 横断的気づき

- **「オフライン優先」と「クラウド主」の選択は一度しか出来ない** — 後から
  方向転換は大手術。最初に Ch1.x 哲学を確定させる必要あり。
- **policy_privacy が選択肢を強制狭める** — 結果的に Ch1.2 / Ch1.4 以外は
  実質選べない。
- **IDB と vault の二層は維持コストが高い** — Ch3 系は MVP には良いが、
  長期は Ch2.3（IDB 真実 + vault export）に収束する可能性。
- **Ch7 書き込みキュー = CRDT の入口** — オフライン編集を本気でやるなら
  Yjs / Automerge 採用が議題に上がる。本ブレストでは触らないが、
  方向性として認識しておく。
- **検索インデックス（03）と cache 層は同居可能** — IDB に index も置けば
  「オフライン全文検索」が成立。これは差別化要因。

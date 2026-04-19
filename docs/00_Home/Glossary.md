# Glossary — M3E 用語辞書

M3E プロジェクト固有の語、および揺れがちな語を正規化する辞書。
**新しい語を skill / map / code に持ち込む前にここへ登録する**。揺れを見つけたら正規語を決めて記載する。

最終更新: 2026-04-20

---

## 運用ルール

- **正規語** を一つ決める。別表記・禁止語は **備考** に記す
- 他の正規語との関係は **関連語** に書く（横断参照）
- 実装命名（code identifier）と仕様語（spec term）が食い違う場合は両方書き、どちらを正とするか明示する
- 凍結・廃止した語は削除せず `status: deprecated` で残す（歴史追跡のため）
- 表形式: `正規語 | 意味 | 関連語 | 備考（禁止・別表記・注意事項を含む）`

---

## 1. プロダクト構造

| 正規語 | 意味 | 関連語 | 備考 |
|---|---|---|---|
| **workspace (ws)** | 永続データ実体の単位。SQLite 本体・backup・audit・cloud-sync などをまとめて保持する入れ物 | map, data profile, owner | 概念階層の最上位。`ws > map > scope > node`。workspaceId を単なる表示ラベルとして使う運用は避ける |
| **map** | workspace 内で扱う 1 つの知識マップ | workspace, node, scope | （別表記）doc / document は非推奨。仕様語は `map`。実装の `docId` は互換名として残る |
| **node** | 思考要素の最小単位。型: text / image / folder / alias | edge, scope, alias | |
| **edge** | 親子関係のみを表す有向関係（親→子） | node | 関係線（補助線）は別概念 |
| **folder** | 一般向け説明で scope を直感的に伝えるために使う語。実装上は nodeType の一種でもある | scope | UI/導入説明で使ってよいが、**仕様・実装の正規語は `scope`** |
| **scope** | map 内の階層的に管理される構造境界。見える範囲・編集範囲を制御する基本単位 | folder, scopen, root scope, facet | M3E 固有の中核概念。（別表記・併用可）folder world |
| **alias** | 他ノードを参照する窓。実体を複製しない | node, scope | 実装語は alias。（仕様語）reference。**alias→alias は禁止** |
| **root scope** | map の最上位 scope | scope, map | |
| **scopen** | 既存 node（群）を scope として区切る操作 | scope, unscopen | 動詞。（別表記）scope 化 |
| **unscopen** | scope の区切りを解除する操作 | scope, scopen | 動詞。境界だけ外し、中身の node は残す。（別表記）非 scope 化 |
| **scope 粒度** | scope で区切るときの分量（1 scope が抱える node 数・意味範囲のサイズ感） | scope, facet | 運用判断用の軸。粒度が粗い/細かいで議論する |

**現時点の整理**:
- 概念階層は `ws > map > scope > node` を基準に考える
- `scope` は M3E 固有概念として前面に出す
- `folder` は一般向け説明や導入時の補助語として使う
- `scopen` / `unscopen` は scope を名詞だけでなく操作動詞としても扱う運用を明示する

## 2. 帯域（Band）

帯域は独立複数軸ではなく、**粒度と構造が連動する単一の進化軸**。詳細は [../01_Vision/Axes.md](../01_Vision/Axes.md)。

| 正規語 | 意味 | 関連語 | 備考 |
|---|---|---|---|
| **Flash** | 断片・素材の領域。マルチモーダル（テキスト/画像/音声/貼付）、日常との連結、突発・散発的アイデア。構造化前 | 昇格, Rapid | inbox は Flash 内の受け皿名 |
| **Rapid** | **文書 1 つ単位**の領域。syntax tree（親子・章立て・節、説明順序あり、線形化可能） | syntax tree, Flash, Deep | 現在の実装中心。Freeplane mindmap / LaTeX 章立て的 |
| **Deep** | **文書群・知識体系**の領域。semantic graph（多種エッジ、説明順序と独立、同ノードが複数経路に現れる） | semantic graph, 世界モデル, 射影 | nLab / Wikidata / mathlib4 dep 網的 |
| **昇格 (promote)** | Flash → Rapid への統合操作 | Flash, Rapid, 体系化, 射影 | |
| **体系化** | **Rapid → Deep** への変換操作。複数文書を束ねて概念網に編み上げる | Rapid, Deep, 射影 | 射影の逆方向 |
| **射影 (projection)** | **Deep → Rapid** への変換操作。体系から特定目的の説明順序を持つ 1 文書を切り出す | Deep, Rapid, 世界モデル, 体系化 | 同じ Deep から科研費/学振/JST 等を別々に射影。世界モデル=資産、射影出力=使い捨て。`memory/project_projection_vision.md` 参照 |
| **syntax tree** | 親子・線形化可能・説明順序ありの木構造。Rapid の内部構造 | Rapid, semantic graph | 本文・章立て・Freeplane mindmap 的 |
| **semantic graph** | 多種エッジ・説明順序非依存の網構造。Deep の内部構造 | Deep, syntax tree | （禁止）semantic tree — tree ではなく graph。akaghef 用法でも避ける |
| **世界モデル** | Deep の到達形。射影の源泉となる資産 | Deep, 射影 | |

## 2.5 facet（プロジェクト観点）

| 正規語 | 意味 | 関連語 | 備考 |
|---|---|---|---|
| **facet** | PJ の一側面を切り出した scope であり、かつその切り出しが**意味単位として凝集している**もの。両方の条件を満たす場合のみ facet と呼ぶ | scope, alias, 小分類 | **PJ 直下の第一階層に限定**。内部サブツリーは「小分類」として扱う。**scopen 粒度・レイアウティング規則は facet ごとに定義**、内部はそれに従う。実体は 1 箇所、他 facet からは alias で参照。（禁止）「12 スコープ」「観点スコープ」 |
| **facet 跨ぎ操作** | 複数 facet にまたがる link / alias 作成・更新 | facet, alias | サブワーカーは原則実行しない（並行書き込み race 回避）。マネージャー session が batch でまとめて行う。（別表記）cross-facet op |
| **小分類** | facet 内部の整理用サブツリー（例: `src/core/`, `src/io/`） | facet, scope | ただの scope として扱う。facet 要件（PJ 一側面 + 凝集）は課さない。親 facet の規則に従う |

初出: AlgLibMove プロジェクト（2026-04-15、[../../projects/PJ01_AlgLibMove/plan.md](../../projects/PJ01_AlgLibMove/plan.md)）
定義確定: 2026-04-16 — 「PJ の一側面 かつ 意味単位で凝集」の両立要件に合意。PJ 直下限定。内部サブツリーは小分類として別扱い。
機能追加: 2026-04-17 — facet は scopen 粒度・レイアウティング規則を定義する単位。書き込み時はその facet の規則に従うことを運用ルール化。

## 3. 計画階層（Principle → Vision → Strategy → Goal → Task）

5層で構成する。固定原則と未達ギャップを分ける。**判断は Strategy 層で行う**。task は大量になるのでテキストでプールする。

| 層 | 役割 | 置き場 | 粒度 |
|---|---|---|---|
| **Principle** | 破ってはいけない原則。当たり前になっていても守る判断基準 | `docs/01_Vision/Principle.md` | 固定・長期 |
| **Vision** | まだ埋まっていない上位ギャップ。半月単位で見直す | `docs/01_Vision/Vision.md` / `docs/00_Home/Objective.md` | 長期・未達中心 |
| **Strategy** | Vision をどう攻めるか。判断・優先度はここ | `docs/01_Vision/Strategy.md` / `docs/00_Home/Objective.md` / map `DEV/strategy/` | 中期・日次更新可 |
| **Goal** | strategy 配下の具体的な到達点 | map `DEV/strategy/<Project>/Goal` ノード | 機能単位 |
| **Task** | 実作業単位。大量。 | **テキストでプール**（`06_Operations/Todo_Pool.md` or map の text ノード） | 30分〜数時間 |

**運用**:
- Principle は頻繁に書き換えない。揺れた時の判断基準として参照する
- Vision には「原則」ではなく「未達ギャップ」を書く
- agent・人間が判断する時は **strategy 層を読む**。task は流し読み
- task は書き殴って貯める（フォーマット緩め、優先度は strategy で付ける）
- task が重要判断を含む場合は strategy に昇格、または `reviews/Qn` 起票

### 3.1 参照 ID 運用

| ID | 用途 | 安定性 | 備考 |
|---|---|---|---|
| **P1, P2, ...** | Principle の安定参照 ID | repo-wide で長期固定 | 並び替えで付け替えない |
| **V1, V2, ...** | Vision の安定参照 ID | repo-wide で長期固定 | 半月見直しでも既存 ID は維持する |
| **S1, S2, ...** | Strategy の安定参照 ID | repo-wide で長期固定 | 日次更新しても既存 ID は維持する |
| **G1, G2, ...** | Goal のローカル ID | session / board / document 単位で一貫 | 長期固定は要求しない |
| **T1, T2, ...** | Task のローカル ID | session / board / document 単位で一貫 | 長期固定は要求しない |

**運用規則**:
- `P*`, `V*`, `S*` は repo 全体で使う安定 ID とする
- `P*`, `V*`, `S*` は重要度順ではなく識別子として扱う
- 並び替えや再編集で `P*`, `V*`, `S*` の番号を付け替えない
- 廃止項目が出ても欠番を許容する
- `G*`, `T*` はセッションや task board の中で一貫していればよい
- 下位項目は、可能な限りどの `P*` / `V*` / `S*` に関係するかを明示する

### 3.2 個数ガイド

- `P*`, `V*`, `S*` は増やしすぎない。今くらいの個数感を維持する
- 目安:
  - Principle は 5〜10 個程度
  - Vision は 3〜6 個程度
  - Strategy は 10〜20 個程度
- 新しい `P*`, `V*`, `S*` を足す前に、既存項目へ統合できないかを先に検討する
- 個数が上限側に寄ってきたら、追加より統合・抽象化・重複削除を優先する

## 4. 開発プロセス

| 正規語 | 意味 | 関連語 | 備考 |
|---|---|---|---|
| **map** | M3E マップ本体（データとしてのグラフ） | canvas, viewer, graph | §1 参照 |
| **canvas** | map を agent ↔ 人間の共有ホワイトボードとして使う時の呼称 | map, reviews/Qn, Agent Status | canvas-protocol skill 参照。（禁止）whiteboard — canvas に統一 |
| **viewer** | map を描画するブラウザ UI | map, meta-panel | |
| **meta-panel** | viewer 上部の UI パネル。モード / scope / ステータス等を表示 | viewer | `beta/README.md` 記載の正式名。（別表記）メタパネル |
| **graph** | map の**グラフ形式**表現（node + edge の構造そのもの） | map, linear | M3E の既定ビュー。`linear` との対比で使う |
| **linear** | 同じ内容を**線形表記**（リスト・アウトライン・本文）で扱う形式 | graph, linear-text, linear-transform | tree → list の写像。編集は linear 側でもできる。（別表記）linear view |
| **linear-text** | linear 形式のテキスト実体（Markdown など） | linear, linear-transform | Obsidian/vault export の出力形。linear-transform 経由で生成 |
| **linear-transform** | graph ↔ linear の相互変換を担うサブエージェント | linear, linear-text, sub-agent | プロバイダ経由で実行、双方向の同期を想定。（別表記）linear-agent |
| **sub-agent** | Manager (devM3E) から dispatch される作業エージェント | Manager, role, linear-transform | （禁止）subagent / subworker / worker — すべて `sub-agent` に統一 |
| **Manager** | devM3E オーケストレーター本体 | sub-agent, gate | |
| **role** | sub-agent の担当領域 (visual / data / team など) | sub-agent, Manager | |
| **reviews/Qn** | 判断待ちキューの個別質問ノード | decisions/, canvas, Ambiguity Pooling | `selected="yes"` で確定。略記 `Q` は会話中のみ可 |
| **decisions/** | 確定した判断のプール（reviews/ から移送） | reviews/Qn | selected が付いた Q はここへ。（同義）decision pool |
| **Agent Status** | map 上の sub-agent 状態可視化ノード | sub-agent, canvas | 固定パス `DEV/Agent Status` |
| **design_doc** | task ノード attribute。設計書のパスを指す | Task | `docs/03_Spec/...` 絶対/相対パス |
| **gate** | ロール間の依存関係。前段 done で後段解放 | Manager, role | Manager が監視 |
| **Ambiguity Pooling** | 曖昧点を block せず reviews/Qn に貯める方針 | reviews/Qn, canvas | canvas-protocol 規定 |

## 5. 凍結・廃止語（deprecated）

| 語 | status | 扱い | 備考 |
|---|---|---|---|
| **MVP** | deprecated (2026-04-15) | 段階論としては凍結。ドキュメントの新規記述で使わない | コード中の `RapidMvpModel` 等の命名は歴史的残滓として残る（リネームは別タスク） |

## 6. 実装命名との対応（コード ↔ 仕様）

| コード識別子 | 仕様語 | 関連語 | 備考 |
|---|---|---|---|
| `RapidMvpModel` | Rapid 帯域のデータモデル | Rapid | MVP は歴史的残滓。`RapidModel` リネームは Rule_Backlog に積む |
| `AppState` | map 全体の state スナップショット | map | |
| `docId` / `documentId` | map 識別子 | map, mapId | 実装互換名として当面残す。仕様説明では `mapId` / `map` を優先する |
| `scopeId` | scope の node id | scope | 現行 API は `scopeId`。仕様語とも一致させる |
| `workspaceId` / `wsId` | workspace の内部識別子 | workspace, wsLabel | 保存先フォルダを一意に決める内部 ID。ユーザーには基本見せない |
| `wsLabel` | workspace の表示名 | workspace, wsId | 例: `Akaghef-personal` |
| `mapId` | map の内部識別子 | map, mapLabel, mapSlug | `map_<ULID>` を正本にする |
| `mapLabel` | map の表示名 | map, mapId | 例: `開発`, `研究`, `tutorial` |
| `mapSlug` | map の固定スラッグ | map, mapId | 例: `beta-dev`, `beta-research`, `final-tutorial` |

## 6.1 データ運用軸

| 正規語 | 意味 | 関連語 | 備考 |
|---|---|---|---|
| **channel** | 実行チャネル。`beta` / `final` | beta, final | アプリ側の軸 |
| **data profile** | データの役割・安全性レベル。`personal` / `seed` / `temp` / `test` など | workspace, owner | データ運用側の軸 |
| **owner** | 誰のデータかを表す属性 | workspace, data profile | 現時点の個人運用では `akaghef` |

## 6.2 現在の標準 runtime モデル

| 項目 | 現在の標準 |
|---|---|
| owner | `akaghef` |
| data profile | `personal` |
| workspace label | `Akaghef-personal` |
| workspace id | `ws_<ULID>` |
| map id | `map_<ULID>` |
| Akaghef personal の初期 map | `開発` / `研究` |
| Akaghef personal の固定 slug | `beta-dev` / `beta-research` |
| final 配布版の初期 map | `tutorial` のみ |

**補足**:
- `ws` は DB ファイル単体ではなく、`data.sqlite`, `backups/`, `audit/`, `cloud-sync/`, `conflict-backups/` などを含む永続フォルダ単位
- `wsLabel` と `wsId` は分離する。表示名の変更で内部識別子と保存先は変えない
- `mapLabel` と `mapId` も分離する。`mapLabel` は変更可能、`mapId` は不変、`mapSlug` は固定
- `beta` / `final` は channel であり、概念上は map そのものとは別軸

## 7. サーバー・ポート

| 正規語 | ポート | 関連語 | 備考 |
|---|---|---|---|
| **beta** | 4173 | channel, final | 開発 default。agent 操作・map API は原則ここ。実装互換名としての `docId` は残りうる |
| **final** | 38482 | channel, beta | 配布・安定版確認。実装互換名としての `docId` は残りうる |

**規則**: agent は dev 作業中 `4173` を使う。`38482` を使うのは final 確認時または明示指示があった時のみ。

## 8. ファイル構成系

| 正規語 | 意味 | 関連語 | 備考 |
|---|---|---|---|
| **beta/** | 開発対象ソース | final/, channel | `final/` は本番、触らない |
| **docs/** | 設計・運用ドキュメント | daily, ADR, handoff | 日本語記述が基本 |
| **daily** | 作業日記 `docs/daily/YYMMDD.md` | docs/ | 追記のみ・改変禁止 |
| **ADR** | Architecture Decision Record `docs/09_Decisions/ADR_NNN_*.md` | docs/ | |
| **handoff** | 作業引き継ぎ文書 `docs/tasks/handoff_*.md` | docs/ | |

---

## 追加したい語 / 揺れ発見時

このファイルに追記 → commit。議論が必要なら `reviews/` に Q として起票してから正規語を決める。

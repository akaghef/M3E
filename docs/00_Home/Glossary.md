# Glossary — M3E 用語辞書

M3E プロジェクト固有の語、および揺れがちな語を正規化する辞書。
**新しい語を skill / map / code に持ち込む前にここへ登録する**。揺れを見つけたら正規語を決めて記載する。

最終更新: 2026-04-16

---

## 運用ルール

- **正規語** を一つ決める。**別表記/禁止語** を併記する
- 実装命名（code identifier）と仕様語（spec term）が食い違う場合は両方書き、どちらを正とするか明示する
- 凍結・廃止した語は削除せず `status: deprecated` で残す（歴史追跡のため）
- 表形式: `正規語 | 意味 | 別表記/禁止語 | 備考`

---

## 1. プロダクト構造

| 正規語 | 意味 | 別表記 / 禁止語 | 備考 |
|---|---|---|---|
| **workspace (ws)** | 永続データ実体の単位。SQLite 本体・backup・audit・cloud-sync などをまとめて保持する入れ物 | workspaceId を単なる表示ラベルとして使う運用 | 概念階層の最上位。`ws > map > scope > node` |
| **map** | workspace 内で扱う1つの知識マップ | doc / document | 仕様語としては `doc` より `map` を優先する |
| **node** | 思考要素の最小単位。型: text / image / folder / alias | - | |
| **edge** | 親子関係のみを表す有向関係（親→子） | 関係線 (別物) | 関係線は補助線で別概念 |
| **folder** | 一般向け説明で scope を直感的に伝えるために使う語。実装上は nodeType の一種でもある | - | UI/導入説明で使ってよいが、仕様と実装の正規語は `scope` |
| **scope** | map 内の階層的に管理される構造境界であり、見える範囲・編集範囲を制御する基本単位 | folder world (同義、併用可) | M3E 固有の中核概念として扱う |
| **alias** | 他ノードを参照する窓。実体を複製しない | reference (仕様語) | 実装語は alias。alias→alias は禁止 |
| **root scope** | map の最上位 scope | - | |
| **scopen** | 既存 node（群）を scope として区切る操作 | scope 化 | 動詞。scope 境界を新設する行為 |
| **unscopen** | scope の区切りを解除する操作 | 非 scope 化 | 動詞。境界だけ外し、中身の node は残す |
| **scope 粒度** | scope で区切るときの分量（1 scope が抱える node 数・意味範囲のサイズ感） | - | 運用判断用の軸。粒度が粗い/細かいで議論する |

**現時点の整理**:
- 概念階層は `ws > map > scope > node` を基準に考える
- `scope` は M3E 固有概念として前面に出す
- `folder` は一般向け説明や導入時の補助語として使う
- `scopen` / `unscopen` は scope を名詞だけでなく操作動詞としても扱う運用を明示する

## 2. 帯域（Band）

| 正規語 | 意味 | 別表記 / 禁止語 | 備考 |
|---|---|---|---|
| **Flash** | 反応領域。閃き・割り込み・種を逃さない | inbox (Flash 内の受け皿名) | |
| **Rapid** | 作業領域。普段使い・草稿・速度優先 | - | 現在の実装はここ中心 |
| **Deep** | 構造化領域。設計図（変化し続ける） | - | |
| **昇格 (promote)** | Flash → Rapid への統合操作 | - | |

## 2.5 facet（プロジェクト観点）

| 正規語 | 意味 | 別表記 / 禁止語 | 備考 |
|---|---|---|---|
| **facet** | PJ の一側面を切り出した scope であり、かつその切り出しが**意味単位として凝集している**もの。両方の条件を満たす場合のみ facet と呼ぶ | （禁止）「12 スコープ」「観点スコープ」 | **PJ 直下の第一階層に限定**。facet 内部のサブツリー（例: `src/core/`）は「小分類」として扱う。**scopen 粒度・レイアウティング規則などのローカル規則は facet ごとに定義**し、内部の小分類・node はそれに従う。書き込み時はその facet の規則に従うこと。実体は 1 箇所、他 facet からは alias で参照 |
| **facet 跨ぎ操作** | 複数 facet にまたがる link / alias 作成・更新 | cross-facet op | サブワーカーは原則実行しない（並行書き込み race を避けるため）。マネージャー session が batch でまとめて行う |
| **小分類** | facet 内部の整理用サブツリー（例: `src/core/`, `src/io/`） | - | ただの scope として扱う。facet 要件（PJ 一側面 + 凝集）は課さない。親 facet の規則に従う |

初出: AlgLibMove プロジェクト（2026-04-15、[../projects/PJ01_AlgLibMove/plan.md](../projects/PJ01_AlgLibMove/plan.md)）
定義確定: 2026-04-16 — 「PJ の一側面 かつ 意味単位で凝集」の両立要件に合意。PJ 直下限定。内部サブツリーは小分類として別扱い。
機能追加: 2026-04-17 — facet は scopen 粒度・レイアウティング規則を定義する単位。書き込み時はその facet の規則に従うことを運用ルール化。

## 3. 計画階層（Vision → Strategy → Goal → Task）

4層で構成する。**判断は Strategy 層で行う**。task は大量になるのでテキストでプールする。

| 層 | 役割 | 置き場 | 粒度 |
|---|---|---|---|
| **Vision** | 究極目的・思想 | `docs/01_Vision/Core_Principles.md` | 固定・長期 |
| **Strategy** | 目標達成の方針。判断・優先度はここ | map `DEV/strategy/` のツリー | 中期・枝分かれで詳細化 |
| **Goal** | strategy 配下の具体的な到達点 | map `DEV/strategy/<Project>/Goal` ノード | 機能単位 |
| **Task** | 実作業単位。大量。 | **テキストでプール**（`06_Operations/Todo_Pool.md` or map の text ノード） | 30分〜数時間 |

**運用**:
- agent・人間が判断する時は **strategy 層を読む**。task は流し読み
- task は書き殴って貯める（フォーマット緩め、優先度は strategy で付ける）
- task が重要判断を含む場合は strategy に昇格、または `reviews/Qn` 起票

## 4. 開発プロセス

| 正規語 | 意味 | 別表記 / 禁止語 | 備考 |
|---|---|---|---|
| **map** | M3E マップ本体（データとしてのグラフ） | - | |
| **canvas** | map を agent ↔ 人間の共有ホワイトボードとして使う時の呼称 | whiteboard (禁止、canvas に統一) | canvas-protocol skill 参照 |
| **viewer** | map を描画するブラウザ UI | - | |
| **meta-panel** | viewer 上部の UI パネル。モード / scope / ステータス等を表示 | メタパネル | `beta/README.md` 記載の正式名 |
| **graph** | map の**グラフ形式**表現（node + edge の構造そのもの） | - | M3E の既定ビュー。`linear` との対比で使う |
| **linear** | 同じ内容を**線形表記**（リスト・アウトライン・本文）で扱う形式 | linear view | tree → list の写像。編集は linear 側でもできる |
| **linear-text** | linear 形式のテキスト実体（Markdown など） | - | Obsidian/vault export の出力形。linear-transform 経由で生成 |
| **linear-transform** | graph ↔ linear の相互変換を担うサブエージェント | linear-agent | プロバイダ経由で実行、双方向の同期を想定 |
| **sub-agent** | Manager (devM3E) から dispatch される作業エージェント | subagent / subworker / worker (すべて禁止、sub-agent に統一) | |
| **Manager** | devM3E オーケストレーター本体 | - | |
| **role** | sub-agent の担当領域 (visual / data / team など) | - | |
| **reviews/Qn** | 判断待ちキューの個別質問ノード | Q (略記は会話中のみ可) | `selected="yes"` で確定 |
| **decisions/** | 確定した判断のプール（reviews/ から移送） | decision pool (同義) | selected が付いた Q はここへ |
| **Agent Status** | map 上の sub-agent 状態可視化ノード | - | 固定パス `DEV/Agent Status` |
| **design_doc** | task ノード attribute。設計書のパスを指す | - | `docs/03_Spec/...` 絶対/相対パス |
| **gate** | ロール間の依存関係。前段 done で後段解放 | - | Manager が監視 |
| **Ambiguity Pooling** | 曖昧点を block せず reviews/Qn に貯める方針 | - | canvas-protocol 規定 |

## 5. 凍結・廃止語（deprecated）

| 語 | status | 扱い | 備考 |
|---|---|---|---|
| **MVP** | deprecated (2026-04-15) | 段階論としては凍結。ドキュメントの新規記述で使わない | コード中の `RapidMvpModel` 等の命名は歴史的残滓として残る（リネームは別タスク） |
| **MVP Definition** | deprecated | `legacy/` 送り | `02_Strategy/MVP_Definition.md` |
| **Freeplane pivot** | status 要確認 | 有効なら維持、凍結なら legacy へ | `02_Strategy/Current_Pivot_Freeplane_First.md` |

## 6. 実装命名との対応（コード ↔ 仕様）

| コード識別子 | 仕様語 | 備考 |
|---|---|---|
| `RapidMvpModel` | Rapid 帯域のデータモデル | MVP は歴史的残滓。`RapidModel` リネームは Rule_Backlog に積む |
| `AppState` | map 全体の state スナップショット | |
| `docId` / `documentId` | map 識別子 | 実装互換名として当面残す。仕様説明では `mapId` / `map` を優先する |
| `scopeId` | scope の node id | 現行 API は `scopeId`。仕様語とも一致させる |
| `workspaceId` / `wsId` | workspace の内部識別子 | 保存先フォルダを一意に決める内部 ID。ユーザーには基本見せない |
| `wsLabel` | workspace の表示名 | 例: `Akaghef-personal` |
| `mapId` | map の内部識別子 | `map_<ULID>` を正本にする |
| `mapLabel` | map の表示名 | 例: `開発`, `研究`, `tutorial` |
| `mapSlug` | map の固定スラッグ | 例: `beta-dev`, `beta-research`, `final-tutorial` |

## 6.1 データ運用軸

| 正規語 | 意味 | 別表記 / 禁止語 | 備考 |
|---|---|---|---|
| **channel** | 実行チャネル。`beta` / `final` | - | アプリ側の軸 |
| **data profile** | データの役割・安全性レベル。`personal` / `seed` / `temp` / `test` など | - | データ運用側の軸 |
| **owner** | 誰のデータかを表す属性 | - | 現時点の個人運用では `akaghef` |

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

| 正規語 | ポート | docId | 用途 |
|---|---|---|---|
| **beta** | 4173 | 実装互換名としての `docId` は残りうる | 開発 default。agent 操作・map API は原則ここ |
| **final** | 38482 | 実装互換名としての `docId` は残りうる | 配布・安定版確認 |

**規則**: agent は dev 作業中 `4173` を使う。`38482` を使うのは final 確認時または明示指示があった時のみ。

## 8. ファイル構成系

| 正規語 | 意味 | 備考 |
|---|---|---|
| **beta/** | 開発対象ソース | `final/` は本番、触らない |
| **docs/** | 設計・運用ドキュメント | 日本語記述が基本 |
| **daily** | 作業日記 `docs/daily/YYMMDD.md` | 追記のみ・改変禁止 |
| **ADR** | Architecture Decision Record `docs/09_Decisions/ADR_NNN_*.md` | |
| **handoff** | 作業引き継ぎ文書 `docs/tasks/handoff_*.md` | |

---

## 追加したい語 / 揺れ発見時

このファイルに追記 → commit。議論が必要なら `reviews/` に Q として起票してから正規語を決める。

# Map View Frameworks for M3E

M3E マップを **そのままのツリー/グラフ表示ではなく、特定のフレームワークの軸に
再配置して見るビュー** の候補をブレインストームする。

Eisenhower 緊急度×重要度マトリクスのような 2D 配置を皮切りに、
研究支援ツールとして有効なビューを網羅的に列挙する。

## 方針

- **採用判断はしない**。価値ありそうなフレームワークを広く集める
- **実装は考えない**。ノードのどの属性を何軸に取るかだけ簡単にメモ
- **研究者向けに有効なもの** を意識する（M3E は研究思考支援）
- 同じマップを **複数フレームワークで切替えて見る** ことを前提に整理

## ファイル構成

- [01_2d_matrices.md](01_2d_matrices.md) — 2×2/2×N の二軸マトリクス系（Eisenhower 含む）
- [02_linear_temporal.md](02_linear_temporal.md) — 時系列・カンバン・ファネル・ガントなど線形系
- [03_radial_network.md](03_radial_network.md) — 同心円・放射・ネットワーク・星座など中心構造系
- [04_process_lifecycle.md](04_process_lifecycle.md) — OODA/PDCA/Cynefin/ピラミッド等のプロセス・階層系
- [05_research_knowledge.md](05_research_knowledge.md) — 研究固有・知識整理（Zettelkasten, PARA, ギャップ分析）
- [06_implementation_thoughts.md](06_implementation_thoughts.md) — 横断: ビュー切替・ハイブリッド・実装方針

## フレームワーク全体像

| 系統 | 代表例 | 軸の数 | 主な用途 |
|------|--------|-------|---------|
| 2D マトリクス | Eisenhower / Effort×Impact / BCG | 2 | 優先度判断、ポートフォリオ |
| 線形（時系列） | Timeline / Gantt / Spiral | 1（時間） | スケジューリング、進捗 |
| 線形（プロセス） | Kanban / Funnel / Pipeline | 1（段階） | 状態管理 |
| 放射 / 中心構造 | Mind map / Concentric / Radial | 0次元（中心点） | 主題からの広がり |
| ネットワーク | Force-directed / Constellation | グラフ | 関係性、クラスタ |
| 階層 / 積層 | Pyramid / Iceberg / Stack | 1（高さ） | 上下関係、深さ |
| ループ・サイクル | OODA / PDCA / Double Diamond | 円環 | 反復プロセス |
| 領域分割 | SWOT / Cynefin / 4P | 4象限以上 | 分類 |
| 研究固有 | Hypothesis × Evidence / Gap matrix | 2〜N | 研究設計 |

合計でざっと **40+ フレームワーク** を後続ファイルで列挙する。

## 全フレームワーク横断の共通課題

どのフレームワークを採用するにしても、共通で考えるべき点:

- **C1. 軸の値を何から取るか** — 既存属性（status/priority等）/ 新規属性 / 計算値 / 手動配置
- **C2. 全ノード対象 vs サブツリー対象** — マップ全体は重すぎるかも
- **C3. ノードがフレームワークに乗らない場合** — 「未分類」エリアを作る / 非表示 / グレー
- **C4. ビュー切替時のノード位置の保存** — フレームワーク毎に座標を保持するか、毎回計算
- **C5. ビュー上で属性編集** — 配置をドラッグして属性を更新できるか
- **C6. ビュー間の遷移演出** — 瞬時切替 / アニメーション / 明示的にロード

これらは [06_implementation_thoughts.md](06_implementation_thoughts.md) で深掘り。

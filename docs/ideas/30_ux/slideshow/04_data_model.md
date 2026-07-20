# 04. データモデルと永続化・エクスポート

## ツアー1件の論理データ

最小モデル:

```ts
type Tour = {
  id: string;            // tour_xxx
  name: string;          // "advisor-2026Q2"
  description?: string;
  steps: TourStep[];
  createdAt: string;
  updatedAt: string;
};

type TourStep = {
  nodeId: string;
  note?: string;         // ツアー固有の注釈（論点H4）
  cameraOverride?: {     // 論点A2 を取る場合のみ
    zoom?: number;
    centerOffset?: [number, number];
  };
  duration?: number;     // 自動進行時の滞留秒数
};
```

省略可能項目を後から足せるよう、最初は `nodeId` の配列だけでも可。

## 論点J. 永続化先

| 方式 | 場所 | 互換性 | 備考 |
|------|------|--------|------|
| J1. マップ JSON 内 `state.tours` | 同じファイル | 既存読み込み手を改修 | 移行スクリプト不要、最短 |
| J2. マップ JSON 同階層 `*.tour.json` | 別ファイル | マップは無傷 | Vault 同期どうする |
| J3. localStorage | ブラウザ | 共有不可 | 個人実験向け |
| J4. URL パラメータ | リンク | 共有最強だが容量限界 | 短いツアーのみ |
| J5. Vault の md ノード本文に埋込 | md 側 | 既存 vault 機構と相性 | パースが面倒 |

- **MVP**: J1 が無難。スキーマバージョンを上げて読み書きするだけ
- **共有重視**: J4 と J1 を併用（URL があれば一時的に上書き）

## ノード削除との整合性（dangling reference）

- 削除時の選択肢
  - K1. 削除を拒否（依存があるよと警告）
  - K2. 削除はしてツアーから自動的に外す
  - K3. 削除はしてツアー側に「missing step」マーカーを残す（後で復元可能）
- 既存の M3E は削除を拒否しない方向だと思うので **K2 がデフォルト、K3 をオプション** が穏当

## 論点K. エクスポート

| 形式 | 価値 | 実装難度 |
|------|------|---------|
| K1. なし（live のみ） | MVP に最適 | ゼロ |
| K2. PDF（各ステップを1ページ） | オフライン共有 | 中（SVG を1枚ずつレンダ） |
| K3. 静的 HTML（自己完結） | URL 配布 | 中（viewer の subset を bundle） |
| K4. 動画（mp4 / gif） | SNS 拡散 | 高（puppeteer + ffmpeg） |
| K5. Markdown スライド（reveal 互換） | 既存ツールに連携 | 中 |
| K6. 共有リンク（live + ツアー指定 URL） | 軽い | 低（URL パラメータ拡張） |

- **MVP**: K1 + K6（URL に `?tour=advisor-2026Q2&step=3` を入れるだけ）
- 後段で K2/K3 を追加すると発表に強くなる
- K4 は需要が出てから

## 既存機能との衝突チェック

- `?ws=` `?map=` `?scope=` 既存 URL params と並ぶ → `?tour=` `?step=` を追加で衝突なし（コミット d0b5173 と整合）
- `centerOnNode` の zoom 引数は既に存在 → カメラ制御は流用可
- collapse 状態との関係: ツアー再生時に折りたたまれていたら自動で展開するか
  - L1. 自動展開（推し）
  - L2. そのまま（折りたたみ表示で見せる）
  - L3. ステップ毎に「展開状態」も保存して復元

L3 は強力だが scope が膨らむ。L1 → 必要なら L3 へ。

## エージェント／LLM からの利用

ツアー = 「マップの読み筋」なのでエージェントが
- ツアーを解析してそのまま作業順序にする
- 自分でツアーを生成して人間に「これを見て」と提示する

という使い方ができる。MCP server / REST API で
- `GET /tours`
- `GET /tours/:name`
- `POST /tours/:name/steps`

を生やすだけで多くのユースケースをカバーできる。
（既存 m3e-map skill の API 拡張で対応可能）

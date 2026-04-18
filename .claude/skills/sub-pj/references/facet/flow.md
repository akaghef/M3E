# facet レイアウト: 処理フロー

時系列の処理手順、呼び出しチェーン、パイプラインを扱う facet のスコープ粒度ルール。

## スコープ粒度

| 単位 | スコープ化 | 条件 |
|------|-----------|------|
| シナリオ（1 つの処理フロー全体） | **1 シナリオ = 1 scope** | 常に |
| フェーズ（シナリオ内の大きなまとまり） | **1 フェーズ = 1 scope** | ステップ数 > 10 |
| 個別ステップ | **unscope** | 常に（scope 内のノードとして並べる） |

## 軸の方向（必ず明示しろ）

- **depth 方向 = 時間軸**（上から下へ時間が流れる）
- **breadth 方向 = 並列**（同時に起きることを横に並べる）

この規約を plan.md に明記しろ。暗黙にするな。

## 具体例

```
scenario_A/                          ← scope: 「ユーザーが X を実行する」
├── phase_init/                      ← scope: 初期化フェーズ（12 ステップ）
│   ├── step1: 設定読み込み
│   ├── step2: 接続確立
│   └── ...
├── step_validate: 入力検証           ← unscope（単体ステップ）
├── phase_process/                   ← scope: 処理フェーズ
│   ├── step_a: 変換
│   ├── step_b: 計算               ← 並列なら breadth に並べる
│   └── step_c: 集約
└── step_return: 結果返却            ← unscope
```

## ノード属性

| attribute | 必須 | 例 |
|-----------|------|-----|
| label | Yes | `setConst 呼び出し` |
| summary | Yes | `Hopf 分岐で構造定数を計算。VectAlg.setConst を呼ぶ` |
| kind | Yes | `scenario` / `phase` / `step` / `branch` |
| order | No | `3`（フロー内の順序番号） |
| duration | No | `~60ms`（実行時間の目安） |

## link と alias

- 同一シナリオ内のステップ間依存 → **link**（`calls`, `triggers` 等）
- 異なるシナリオ間の共通ステップ → **alias** で配置
- 分岐（if/else）→ breadth に並列配置。`kind: "branch"` で区別
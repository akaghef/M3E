# timeseries facet の具体契約

ここでは `facet type = timeseries` を、処理フローとは分けて固定する。

timeseries は flow と近いが、主役は「処理手順」ではなく **観測された出来事・状態変化・レビュー履歴の時間軸**である。

対象は:

- PJ の週次 / 日次進捗
- agent run / evaluation run
- map import / sync / review のイベント列
- formalization status の変化
- 実験ログ、失敗、再実行、判断履歴

## 第一規約

**timeseries facet では `depth = time` とし、`breadth = co-temporal events` とする。**

これを最優先ルールとする。

## 具体契約

| 項目 | 契約 |
|---|---|
| `parent-child` | 時間粒度の階層、または event -> evidence |
| `depth` | 古い -> 新しい。必ず時間順 |
| `row / breadth` | 同じ時刻 / 同じ期間に起きた並列イベント |
| `GraphLink` | causality、trigger、result_of、evidence、related task |
| `anchor` | day / week / run 単位の表示 grouping として使う |
| `scope` | `unscoped` 寄り。ただし長期ログは期間 scope 可 |
| `fill` | event importance / impact |
| `border` | uncertainty / risk / failure severity |
| `collapse` | day / week anchor は open、個別 evidence は folded 可 |

## flow との違い

| 観点 | flow | timeseries |
|---|---|---|
| 主役 | 設計された処理順 | 実際に起きた出来事 |
| depth | 処理順 / 時間順 | 時間順のみ |
| breadth | 同 stage の並列処理 | 同時期に起きたイベント |
| anchor | 原則 off | day / week / run anchor は有効 |
| link | 例外経路・補助依存 | causal / evidence / result |

flow は「どう進むべきか」を読む。
timeseries は「何がいつ起きたか」を読む。

## 基本形

```text
Timeline
└── 2026-04-29
    ├── PJv34 loop implemented
    ├── DeepSeek smoke succeeded
    └── T-1-1 graph-shaped refactor done

links:
  DeepSeek smoke succeeded -> result_of -> weekly-review-deepseek-latest.json
  T-1-1 graph-shaped refactor done -> implements -> tasks.yaml:T-1-1
```

ここで date node は意味上の phase ではなく、表示用の時間 anchor である。

## depth の既定

`depth` は時間の粒度で読む。

推奨粒度:

1. year / month（長期ログのみ）
2. week
3. day
4. run / event
5. evidence

短期PJでは `day -> event -> evidence` で十分。

## breadth の既定

`breadth` は同じ時間 anchor 配下で起きた co-temporal events を並べる。

- 同じ日に完了した task
- 同じ run で発生した warning
- 同じ週に出た review Qn
- 同じ evaluation cycle の pass / fail / retry

breadth は「同じ時間帯に比較したいもの」であり、因果順ではない。
因果順は GraphLink で補助する。

## anchor の既定

timeseries では anchor を積極的に使う。

### anchor を使う

- day / week / run / release 単位
- event が多く、時間の chunk が必要
- review 時に「この日の出来事」をまとめたい

### anchor を使わない

- event が少なく、時間ノードがノイズになる
- date より phase / dependency の方が主役
- anchor が実体 event に見える

anchor は表示上の grouping であり、状態変化そのものではない。

## color の既定

| ノード種別 | `fill` | `border` |
|---|---|---|
| event | importance / impact | risk / uncertainty |
| failure event | severity | unresolved risk |
| success event | low-emphasis success | none or confidence |
| time anchor | neutral | none |
| evidence | neutral | confidence |

色は時間順を表さない。
時間順は depth で表す。

## link の既定

| link 種別 | 意味 |
|---|---|
| `caused` | event A が event B の原因になった |
| `triggered` | event A が action B を起動した |
| `result_of` | artifact / event が run の結果である |
| `evidence` | event の根拠 artifact |
| `updates` | event が task / status を更新した |

原則:

- 時間順そのものを link にしない
- time anchor 間に causal link を張らない
- event と evidence / task / artifact を link する

## PJ02 での適用

PJ02 では timeseries facet を次に使う。

- Blueprint import run
- Implementation scope materialization
- runtime board update
- evaluation pass / fail
- facet contract completion

このとき:

- `2026-04-17` などの日付 anchor を置く
- 同日に起きた task completion / review / artifact generation を breadth に並べる
- `tasks.yaml:T-1-1` や runtime artifact へ `evidence` / `updates` link を張る

formalization status の変化を扱う場合も、status 自体は progress facet、変化履歴は timeseries facet と分ける。

## Claude の導線

timeseries facet として書けと言われたら、Claude は次の順で判断する。

1. 時間粒度を決める
2. `depth = time` に固定する
3. 同時期イベントを breadth に並べる
4. day / week / run anchor を使う
5. 因果や根拠は link にする
6. event importance を fill、risk / uncertainty を border に使う

## ひとことで言うと

timeseries facet では、**depth は時間、breadth は同時期イベント、anchor は時間 chunk、link は因果と証拠**である。

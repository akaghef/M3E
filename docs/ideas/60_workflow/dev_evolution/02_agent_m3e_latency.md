# Agent × M3E 操作レイテンシの実測と下限

2026-04-19 の対話ダンプ。
「M3E の操作が遅すぎる」という akaghef の訴えを起点に、
Claude Code の会話ログ (75 セッション / 1176 ターン / 4562 tool 呼出) を
総当たり計測して、遅さの正体と物理的下限を特定した記録。

## 起点

> M3E の操作遅すぎるんよね。会話ログから、レイテンシを考察して。

測定対象は `c:/Users/Akaghef/.claude/projects/c--Users-Akaghef-dev-M3E/*.jsonl` の
全タイムスタンプ差分。ユーザー視点の UI 遅延ではなく、**エージェント駆動の
M3E 操作 (指示→読取→決定→書込) の各区間ウォールクロック**を推定した。

## 4 区間の実測 (n=257 の read+write を伴うターン)

| 区間 | median | p75 | p90 | p95 | max |
|---|---|---|---|---|---|
| 指示→初回読取 (T0→T1) | 6.2s | 10.7 | 26.4 | 46.0 | 528 |
| 読取期間 (T1→T2) | 12.5s | 44.0 | 81.5 | 141 | 565 |
| 決定待ち (T2→T3) | 15.9s | 35.0 | 59.2 | 69.7 | 442 |
| **指示→初回書込 (T0→T3)** | **42.2s** | 81.3 | 140.5 | 258 | 584 |
| ターン全長 (T0→T4) | 82.5s | 171 | 332 | 417 | 586 |

読取回数は T0→書込時間を概ね線形に押し上げる (1回 18s, 20回 107s, ≒5s/read)。

## API 失敗は要因ではない

- エラー率: 7.4% (337 / 4562)
- **純リトライ壁時計: 0.2%** (0.46h / 267h)
- Map API (localhost:4173) 失敗: ECONNREFUSED 1 件, HTTP 4xx/5xx 0 件
- エラー有りターンの median (194s) が無しターン (79s) の 2.5 倍なのは、
  複雑な作業ほど失敗しやすいという相関であって因果ではない。

## 真因: 思考ギャップ (tool_result → 次 tool_use)

- n=3890 計測, median **5.35s** / p90 27.1s / p95 54.2s
- 3 秒以内: 21.6% / 5 秒以内: 46.3% / 15 秒超: 16.9%
- 1 ターン平均 3.9 呼出 → 素の思考累積 ≒ 21s

これに (a) ツール実行時間、(b) プロンプト prefill、
(c) サブエージェント起動 (median +3 分) が上乗せされて全体 median 82s。

## ツール別内訳 (全 4562 呼出, 合計 22.3 時間)

| ツール | 呼出数 | exec med | think後 med | 占有率 |
|---|---|---|---|---|
| Bash | 1645 | 0.79s | 5.0s | **32.0%** |
| Read | 996 | 0.02s | 4.4s | 14.1% |
| Edit | 655 | 0.06s | 6.5s | 12.2% |
| Agent | 110 | **45.8s** | 16.8s | **12.1%** |
| Write | 327 | 0.08s | 6.8s | 11.6% |
| Grep | 405 | 2.0s | 4.8s | 5.5% |
| TodoWrite | 145 | 0.00s | 5.8s | 3.2% |

- Read/Edit/Write の exec はほぼゼロ。遅いのは**前後の思考時間**。
- Agent (サブエージェント) は 110 回で 2.7h 消費。小タスクで呼ぶと即 2 分飛ぶ。

## thinking ブロック有無で切ると劇的

| 状態 | n | gap median | gap p90 |
|---|---|---|---|
| **thinking 無し** (即決) | 2750 | **4.25s** | 13.3s |
| **thinking 有り** | 1233 | **11.4s** | 87.8s |

thinking モードに入った瞬間に median 2.7 倍 / p90 6.6 倍。
Bash no-think 3.82s, Bash think 8.40s。
「API を書く」動作自体のコストは **3〜5 秒が下限**で、
それ以上の時間は thinking + prefill。

### Bash 入力サイズ依存

| curl コマンド長 | n | gap median |
|---|---|---|
| 50〜150 字 | 560 | 4.12s |
| 150〜400 字 | 647 | 4.76s |
| 400〜1000 字 | 212 | 6.71s |
| 1000 字以上 | 50 | 12.3s |

ふつうの curl (150〜400字) は 4.8s。サイズはほぼ効かない。
1000 字超 (JSON ペイロード巨大) で初めて倍増。

## ケーススタディ: 100 ノードの木を指定スコープに書く

前提: 木構造は既にテキスト (md/outline/freemind) で与えられている。
M3E は `POST /api/maps/{mapId}?scope=<nodeId>` でサブツリー一括書き対応。

### 現状

| 流派 | 合計時間 | 根拠 |
|---|---|---|
| ナイーブ (1 ノード 1 curl) | **10〜17 分** | 100 × (think 5s + exec 0.8s) |
| 中庸 (10 本ずつ分割 bulk) | 3〜5 分 | 10 × (think 6s) + JSON 生成 |
| 熟練 (bulk scope POST 1 発) | **1.5〜3 分** | **LLM 出力トークン律速**: 5000 tok × 40〜80 tok/s = 60〜125s |
| ログで観測されがち | 5〜15 分 | Agent 委譲ターン median 228s / p95 539s |

### 理想 (物理下限)

| シナリオ | 合計時間 |
|---|---|
| akaghef 宣言「思考+3 秒」目標 | **3〜8 s** |
| LLM が JSON を全部書く場合の物理下限 | 60〜125 s |
| **決定論的変換器 (非 LLM) + bulk POST** | **3〜5 s** |
| 純 API / 計算限界 (木が手元に既に JSON) | 0.5〜2 s |

### 差分の正体 (100〜300 倍遅い)

1. **LLM 出力トークン速度** (〜100 秒の壁) — モデルを替えない限り超えられない
2. **Bash curl 1 呼出の think_after 5s** — bulk API を使わず per-node で打つと 100 倍乗る
3. **Agent 委譲の 2〜4 分オーバーヘッド** — 木構造タスクを丸ごとサブエージェントに投げると即食われる
4. **スコープ解決の Read 連打** — 毎回木の一部を読み直して確認

## 目標と現状のギャップ

akaghef 宣言: **「指定スコープ内で自由な変更を許可する場合、思考時間 + 3 秒で
できなければならない」**。現状は中央値で 5.35s (思考ギャップのみ) + ツール実行で
**1.5〜2 倍**、複数呼出の累積で **10 倍以上**。

## レバーの優先順位

届きやすい順:

1. **thinking を切る** (スコープ固定 + 書換許可済みの対話で強制 off)
   → 即 **2.7 倍速**、これだけで「思考+数秒」圏内に入る
2. **呼出回数を減らす** (並列 Read、Grep 集約、bulk API 活用)
3. **Agent 委譲をやめる** (小タスクで呼ぶと 1 回で 1〜2 分消える)
4. **LLM に JSON を書かせない経路** (100 ノード級の構造化操作はスクリプト1発化)
   - テキスト形式 (md/freemind/outline) → JSON 変換を決定論的パーサに寄せる
   - Claude は「変換スクリプトを呼ぶ curl」1 本だけ書く
   - 物理下限 ~5s に到達可能

## 今後考えたいこと

- M3E 側に「テキスト tree → JSON」変換 API (`/api/maps/{id}/import-text?format=outline&scope=...`) を生やす
  と、LLM 出力律速が消える。現状 `import-vault` / `import-file` はあるが
  インライン text → scope 書き込みの口がない (要確認)
- `m3e-map` スキル側で「100 ノード超は必ずスクリプト経由」というガードを入れる
- thinking トグル可否。Claude Code の運用として、**「スコープ固定モード」では
  thinking を抑制する**というポリシーを明文化できるか
- Agent 委譲コストが高いことを踏まえ、devM3E の Execute フェーズで
  「何をサブエージェントに投げない」のガイドラインを更新

## 計測スクリプト (参考)

全て `%TEMP%` に置いた使い捨て:
- `m3e_latency.py`: 4 区間計測
- `m3e_errors.py`: エラー/リトライ寄与
- `m3e_by_tool.py`: ツール別内訳
- `m3e_think_content.py`: thinking ON/OFF 分離
- `m3e_by_model.py`: モデル別レイテンシ比較

---

## 続き (2026-04-19 後半)

### モデル比較 (Opus 4.6 / 4.7 / Sonnet 4.6 の実測が混在していたログから)

| ツール | Opus 4.6 med | Opus 4.7 med | Sonnet 4.6 med | Sonnet vs Opus 4.6 |
|---|---|---|---|---|
| 全ツール平均 | 5.86s (n=2582) | 4.69s (n=194) | **4.84s** (n=1215) | 17% 速い |
| Bash curl (50-1000字) | 4.96s | 4.33s | 4.41s | 11% 速い |
| **Write (大量生成)** | 30.98s | 35.93s | **17.60s** | **43% 速い** |
| Edit | 7.73s | 8.72s | 6.72s | 13% 速い |

**結論**: Opus が「遅すぎる」わけではない。**小操作の差は 10-20% に留まる**。
ただし **Write-heavy (100 ノード JSON 等の大量出力) は Sonnet が 43% 速い** ので、
マップ再構築などの自動化は Sonnet 固定する価値あり。
アーキ判断・横断リファクタは retry 回数で逆転しうるので Opus 維持が無難。

### thinking を抑える正しい設定 (claude-code-guide 確認済)

調査前は `/fast` や `effortLevel` で誤解があったが、正解は以下。

| 手段 | 記法 | 効果 |
|---|---|---|
| スラッシュコマンド | `/effort low` | セッション内即切替 |
| 環境変数 (override) | `CLAUDE_CODE_EFFORT_LEVEL=low` | 設定ファイルより優先 |
| 環境変数 (完全 OFF) | `CLAUDE_CODE_DISABLE_THINKING=1` | thinking ブロック消滅 |
| 設定ファイル (永続) | `settings.json` の `"effortLevel": "low"` | 全セッション適用 |
| トークン予算 | `MAX_THINKING_TOKENS=<n>` | thinking 量の上限 |

`effortLevel` 有効値: `low / medium / high / xhigh / max / auto`
- Opus 4.7 デフォルト: `xhigh`
- Opus 4.6 / Sonnet 4.6 デフォルト: `high` (Pro/Max プランは `medium`)
- `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1` は Opus 4.7 には効かない (常に adaptive)

現状は user settings で `"effortLevel": "max"`。M3E だけ落とすなら
`.claude/settings.local.json` に `"effortLevel": "low"` を追加。

### Read 省略ポリシー (feedback memory 化)

akaghef 指示:
> 作業スコープが割り当てられているか、セッション内で前回に呼んでいるか、
> 確認して問題ないなら read しないという方針でやらせる

保存先: [feedback_skip_read_when_scope_known.md](../../../../.claude/projects/c--Users-Akaghef-dev-M3E/memory/feedback_skip_read_when_scope_known.md)
(メモリは `C:\Users\Akaghef\.claude\projects\c--Users-Akaghef-dev-M3E\memory\`)

**スキップ可条件 (どちらか満たせば OK)**:
1. スコープ明示割当済 (file path + 行範囲 / nodeId / API scope がユーザー指定)
2. 同一セッション内で既読 (以降、変更シグナルがなければ再 Read しない)

**例外 (Read 必要)**:
- 直前書込で行番号ズレ / conflict / 404 等のエラー
- ユーザーが「外で編集した」と明示
- 複数ワーカーが同一 scope を触る共同作業モード

**対象**:
- テキストファイル: Edit tool の契約上、セッション初回 1 回は必要。それ以降は省略。
- M3E map API: **単独作業前提なら GET 省略、scope 指定 POST に直行**
- Bash スクリプト / 設定ファイル: 同上

**期待効果**: Read 996 回 / 3.1h / 占有率 14.1% のうち、
「既読ファイルの再 Read」分 (推定 20〜30%) が消える。map GET の省略も加算。

### 未決論点

- M3E 側に inline text → subtree 変換 API を生やすか (出力 LLM 律速を消す本丸)
- `m3e-map` skill に「100 ノード超はスクリプト強制」ガードを入れるか
- Agent 委譲の抑制ガイドラインを devM3E Execute フェーズに書くか
- effortLevel を M3E ローカル (`settings.local.json`) で `low` にする実験

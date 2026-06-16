# 08. 共通パターン: 「キュー → 1件処理 → 次」

複数モードを横断して観察すると、過半が同じ骨格をしている。
このパターンを **共通基盤化** すれば、新しいモードを追加するコストを一気に下げられる。
ここでは構造の詳細と、共通化する際の論点を整理する。

## このパターンに当てはまるモード

| モード | キュー定義 | 1件操作 |
|--------|-----------|--------|
| M01 Review | proposal タグのノード | 承認 / 却下 / 差戻し |
| M02 Triage | 未分類 scratch | カテゴリ移動 / 削除 / 昇格 |
| M04 Conflict resolve | 衝突中のノード | mine / theirs / both |
| M05 Status | ステータス未確定タスク | todo / wip / done / blocked |
| M06 Tagging | 未タグ付け | tag1 / tag2 / ... |
| M07 Estimate | 未見積タスク | XS / S / M / L / XL |
| M08 Decision | 決定待ちノード | go / no-go / defer |
| M11 Cleanup | 削除候補 | delete / archive / keep |
| M23 Sprint plan | 候補タスク | in-sprint / not / stretch |
| M24 Standup | 3サブキュー | mark各種 |
| M25 Retro | 振り返り対象 | keep / problem / try |
| M28 Q&A | 未回答 Qn | answer / defer / ask back |
| M29 Pair-with-agent | エージェント提案 | accept / reject / regen |
| M33 Time-sensitive | 期限付き未着手 | snooze / escalate / archive |

14 モード。**M3E のキーボード駆動UIの過半数がこの骨格に乗る** と推定できる。

## 共通骨格の分解

```
QueueMode = {
  source:       () => Item[]           // キューの元
  ordering:     (Item[]) => Item[]     // 並び順
  presenter:    (Item) => UIElement    // 1件表示
  operations:   { key: (Item) => Action }  // キー → 動作
  cursor:       number                 // 現在位置
  history:      Action[]               // undo 用
  termination:  (state) => boolean     // 終了判定
  onExit:       (state) => void        // 抜ける時の処理
}
```

これに加えて、UI 側で共通化される部分:
- 進捗表示（`3 / 12`）
- 効くキーのチートシート
- 現在アイテム強調
- 「次のアイテム」プレビュー（オプション）
- 終了時のサマリ表示

## 共通化のメリット

- **新モード追加コスト**: 4要素（source/operations/presenter/ordering）を書くだけ
- **UX一貫性**: ユーザはパターンを1度学べば14モードに転用
- **計測しやすい**: 「どのモードで何件処理されたか」を共通計測
- **テストしやすい**: 共通骨格は1度テスト、モード固有は単体テスト
- **段階導入**: 共通骨格を先に作れば、モード本体は週末に1個ずつ足せる
- **学習曲線が緩やか**: 「Mode pattern A」「Mode pattern B」のように分類して教育可能

## 共通化のリスク

- **抽象化の早すぎ**: 1個も実装していない段階で骨格を決めると外す
  - 緩和: 2〜3モードを **重複コードで** 書いてから抽出する（Rule of Three）
- **特殊モードの押し込み**: Standup のように3サブキューあるものを無理に1次元化すると歪む
  - 緩和: 「マルチキュー版」を別パターンとして並列に持つ
- **バリエーションの爆発**: 「やっぱりこのモードだけ違う挙動が要る」が累積
  - 緩和: 共通骨格は最小限、各モードに **拡張ポイント** を意図的に作る
- **共通骨格のバグが全モードに伝染**
  - 緩和: 骨格は薄く、テストは厚く

## 設計論点（共通基盤側）

### Q1. キュー: スナップショット vs ライブ

- **Snapshot**: モード入った瞬間のキューを固定。途中で追加されたアイテムは含まれない
  - 良い点: 進捗が確定的、終わりが見える
  - 悪い点: 別タブで誰かが proposal を追加しても気づかない
- **Live**: 毎回 source() を再評価
  - 良い点: 常に最新
  - 悪い点: 進捗計算が崩れる、無限ループの危険
- **Hybrid**: スナップショット基本 + 「再フェッチ」ボタンで明示的に更新
  - 推し案

### Q2. 順序: 静的 vs 動的

- **静的**: モード入った時に並び順を固定
- **動的**: 操作のたびに優先度再計算（例: cleanup mode で最優先候補を毎回先頭に）
- 多くは静的で十分。動的は cleanup や AI推奨型に限定

### Q3. 操作の確定タイミング

- **即時**: キー押下と同時に書き込み
  - 良い点: 速い
  - 悪い点: 誤操作リスク
- **確認付き**: 1秒の soft-commit 期間、Esc で取消
  - 推し: デフォルトは即時、破壊操作だけ soft-commit
- **バッチ**: 全部選んだ後に Enter で一括確定
  - 一部のモード（Sprint plan 等）には適合

### Q4. undo の粒度

- 直近1操作のみ
- モード内全操作を undo 可能なスタック
- モード抜ける時に「全部適用 / 全部破棄 / 個別選択」を聞く
- **推し**: モード内スタック保持、抜ける時は普通に commit、後から `Ctrl+Z` で戻せる

### Q5. キュー終了時の挙動

- 自動でモード抜ける
- 「終わりました」表示で停止、ユーザが Esc で抜ける
- 関連モードを推奨（review 終わったら triage へ等）
- ループする（永遠の review 業）
- **推し**: 停止 + サマリ表示。次モード推奨は控えめに

### Q6. 中断・再開

- ブラウザ閉じても次回続きから
- セッション内のみ保持
- どこにも保存しない
- **推し**: localStorage に「最後に開いたキューと cursor」だけ。複雑化させない

### Q7. 1件操作中に「飛びたい」場合

- 関連ノードへジャンプ → 戻る、はよくある
- 戻る時にキュー状態を保持する必要
- **推し**: 一時離脱と完全離脱を区別。Tab で peek（戻れる）、Esc で離脱

### Q8. キュー内の「対象を見ながら他のキュー要素」を確認

- 次の3件を画面端に小さく表示
- 全件をミニリストで横に出す
- 出さない（集中重視）
- **推し**: デフォルト出さない、`?` で全件パレット表示

## 各モードの「拡張ポイント」例

共通骨格にプラグするモード固有部分:

```
ReviewMode = QueueMode + {
  source: nodes.filter(n => n.attributes.status === "for-review")
  ordering: byCreatedAt(asc)
  operations: {
    "y": approve,
    "n": reject,
    "r": needsRework,
    "?": askBack,
    ...
  }
  presenter: (item) => <ProposalCard node={item} />
}

TriageMode = QueueMode + {
  source: scratchChildren.filter(n => !n.attributes.category)
  ordering: byCreatedAt(desc)
  operations: dynamic-from-existing-categories
  presenter: (item) => <ScratchCard node={item} />
}
```

書く量は数十行で済む見込み。

## 実装着手案（ボトムアップ）

```
Step 1: M02 Triage を完全に手書きで実装（300行くらい）
Step 2: M01 Review を手書きで実装（300行くらい）
Step 3: 重複箇所を見て QueueMode 共通骨格に抽出（150行くらいに圧縮）
Step 4: M11 Cleanup を共通骨格上で実装（80行くらいで済む）
Step 5: 共通骨格 API をドキュメント化、新モードは 1モード/日 ペースで追加
```

抽出を「2モード書いた後」にするのが Rule of Three の応用。
1モード目で Yegge する、2モード目で Yegge した型を再評価する、3モード目で抽象を確定する。

## マルチキューのバリアント

Standup mode のように **複数サブキューを順に巡回** するパターンも頻出。

```
MultiQueueMode = QueueMode[] + {
  currentQueueIdx: number
  switchPolicy: "manual" | "auto-on-empty" | "round-robin"
}
```

- M24 Standup: yesterday → today → blocker の3パス
- M25 Retro: keep → problem → try
- 「同じパターンの3連発」と見れば共通化容易

## 「キュー型」でないモードとの境界

このパターンに **乗らない** モードも明確化しておく:

| モード | なぜ乗らないか |
|--------|--------------|
| M13 Capture | キュー無し、空白から書き始める |
| M16 Navigation | 操作は「移動」のみ、対象はカーソル位置 |
| M17 Search/Jump | 検索結果はキューだが「1件処理」しない |
| M19 Read | 受動的閲覧、操作は副次的 |
| M20 Slideshow | 順序固定、編集無し（別パターン: linear playback） |
| M21 Compare | 2軸の差分閲覧、対象は1件ではなくペア |
| M31 Color | 単発操作、キュー化しても旨味少ない |

これらは別パターンとして整理:
- **CursorMode** (M13/M14/M15/M16): カーソル中心、入力 or 移動
- **PlaybackMode** (M20): 順序固定の自動再生（slideshow）
- **DiffMode** (M21): 2側比較、選択は対称
- **ModalActionMode** (M31): 1モード1操作（押すと適用→終了）

つまり M3E のキーボード駆動 UI は **4種類のモードパターン** に集約できる:

1. **QueueMode** (14個)
2. **CursorMode** (4個)
3. **PlaybackMode** (1個)
4. **ModalActionMode** (3〜5個)

それ以外（Pair-with-agent 等）はハイブリッド。

## なぜこの整理が重要か

- 33モード全部を別実装するのは現実的でない
- 4パターンに収まるなら **基盤4個 + 各モード設定だけ** で済む
- ユーザ学習も「4パターン」を覚えれば全モードに転用可能
- ドキュメントが書きやすい（パターン別チートシート）
- エージェントが新モードを **自動生成** できる素地になる
  （「キュー定義 + キーマップ」だけ書かせれば動く）

## 論点（パターン基盤側）

- **Pat1. 何個のモードを書いてから抽象化するか** — Rule of Three か、もっと早いか
- **Pat2. 4パターンの境界をどこに引くか** — 上記分類は仮説
- **Pat3. パターン基盤を React コンポーネントにするか、純TS の状態機械にするか**
- **Pat4. パターンをまたいだ操作（Capture 中に Triage に入る等）の扱い**
- **Pat5. ユーザがパターンを意識する必要があるか（透明性 vs 隠蔽）**

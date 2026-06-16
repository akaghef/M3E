# sub-PJ 遂行の一般論 — 振り返り

PJ 横断で適用できる反省・改善パターンを蓄積するファイル。
個別 PJ の反省は各 `projects/PJ{NN}_*/retrospective.md` に書く。ここには一般化できる教訓だけを抽出する。

---

## 2026-04-17: PJ02 立ち上げから

### ディレクトリ・命名規約は PJ 開始前に確認する
- PJ02 で `docs/projects/` に作って `projects/` に移し直す手戻りが発生
- **ルール**: `backlog/meta-subpj-candidates.md` のナンバリング規約セクションを PJ 初手で読む

### ビジョンは最初に「痛み」と「スコープ外」を聞く
- 技術的な Phase 計画が先行し、ビジョン（何のためにやるか）の明文化が後回しになった
- **ルール**: PJ 登録時に以下を埋める — (1) 何が痛いか (2) 半年後の完了像 (3) 明示的に範囲外とするもの

### ブレストと PJ 正式化の間にビジョン凝縮ステップを挟む
- idea/ に大量のブレスト素材があっても、PJ のビジョンは別物。ブレストの「何でもあり」が PJ スコープに漏れ出す
- **ルール**: 正式登録前に README の Vision セクションをユーザーと詰める。Phase 計画はその後

---

## 2026-04-15: PJ01 AlgLibMove 実行からの教訓

### マップのスコープ分割は粗くする（俯瞰できなくなる）
- 12 facets に細かく分割した結果、全体を俯瞰できなくなった
- 「500ノードでも動くので、俯瞰可能な構造にすべきだった」
- **ルール**: scope/facet は最初は 3〜5 個程度から始め、必要に応じて分割する

### ノードにはラベルだけでなく説明を付与する
- ラベルのみのノードが大量にでき、後から見ると意味がわからない
- **原因**: サブエージェントへの指示（プロンプト）でフォーマットを十分に伝えなかった
- **ルール**: ノード作成指示には「各ノードに summary 属性を必ず付ける」を明記する

### サブエージェントへのフォーマット指示は具体例で伝える
- 抽象的なフォーマット指示では意図通りにならない
- **ルール**: plan.md にノード例（具体的な attribute 値を含む）を書き、サブエージェントに参照させる

### フロー図は depth=時間軸, breadth=並列 を明示する
- 呼び出しフロー構造で時間軸の方向が不明確だった
- **ルール**: flow/sequence 系のノード構造を作る際は、depth と breadth の意味を plan.md に明記する

### 設計レビューは 5段階スコア + pros/cons + 推奨タグ形式
- 設計選択肢の比較が効率的になった（PJ01 で検証済み）
- **ルール**: ★1-5 スコア、メリット/デメリット箇条書き、【推奨】タグ

### 一気通貫実装（ワンショット委任）は有効だが確認ポイントが必要
- 「一切確認なしで一気に」を実行した結果、移植はかなり進んだが細部の修正が残った
- **ルール**: ワンショット委任する場合も、成果物のレビュー/テスト通過を終了条件にする

---

## 2026-04-21: PJ03 SelfDrive から

### SSOT は宣言 + 機械検査で保証する
- Phase 1 で WorkflowState に invariant field を宣言しつつ、tasks.yaml writeback には含めなかった（escalationKind / wakeupAt / wakeupMechanism / failureReason が resume で null に潰れる）。Gate 2 差戻の主因
- 設計文書の宣言だけでは弱い。save/load round-trip test で欠落ゼロを強制する
- **ルール**: SSOT を名乗る層には、全 invariant field を save→load で deep-equal する restore test を Gate 条件として必須化する

### 名前と実体の一致 — 過大評価の回避
- Phase 1 で runner を「engine」と呼んだが実体は signal reducer だった。akaghef 差戻の 2 大論点の 1 つ
- 実装の責務と名前がズレた時点で、名前を先に直す（rename を遅延するほど debt が増える）
- **ルール**: plan.md に「reducer / engine / orchestrator / daemon」の責務定義を書き、実装が定義から外れたら名前を即 rename。Phase gate で名前 ↔ 実体の一致を確認項目に加える

### Schema breaking change 後は migration script を即削除
- Phase 1.5 で tasks.yaml schema を変更（machine state を除去）したが、migrate_checkpoints.ts / strip_tasks_state.ts / add_task_fields.ts を残した結果、Phase 2 kickoff で legacy script を再実行し全 checkpoint を破壊（Qn4）
- 一度役目を終えた migration は「再実行で壊す」罠になる
- **ルール**: schema breaking change の commit で、対応する migration script は同じ commit で削除する。残す場合は script 冒頭で `schema_version` を assert する pattern を強制

### Gate 根拠に "code-reachable" は弱い
- Phase 1 Gate 2 で sleeping / escalated / failed を「code-reachable だから OK」と主張して差戻された
- state machine 系では「遷移できる」と「運用可能」は別。永続化欠落があれば到達可能でも運用成立は示せない
- **ルール**: Gate readiness template に「実稼働観察の有無」「観察未達の defer 理由」を明記する欄を必須化する。code-reachable だけで通そうとしない

### akaghef 指示の項目数に tasks を 1:1 で合わせる
- Phase 1.5 rework で akaghef P1-P4 の 4 項に T-1-8..T-1-11 を 1:1 に起票、Phase 2 で akaghef 4 着手条件に T-2-1..T-2-4 を 1:1 に起票。Evaluator / Manager の責務分担が自然に決まり手戻りが減った
- **ルール**: rework / phase kickoff の task 起票時、ユーザー指示の項目数と task 数を揃える。1 項目に複数 task が必要なら subdivision を明示する

### Projection は一方向（SSOT 逆流禁止）
- Phase 3 で checkpoint JSON → M3E AppState の projection を実装時、最初から map → reducer の逆流を設計で禁止した結果、責務混線が発生しなかった
- SSOT を持つレイヤから下位の表示レイヤには write-only
- **ルール**: projection / view 層を新設する時、SSOT 側への書き戻しを設計で明示的に禁止する。双方向にすると debt が急増する

### Evaluator が見逃すパターン — architecture integrity
- narrow 契約の Evaluator は task 単体の done_when/eval_criteria しか見ない。PJ 全体を跨ぐ不変性（SSOT 整合・責務境界・naming）は見落とす
- Phase 1 Gate 2 で persistence gap が Evaluator 通過した理由はこれ
- **改善候補**: "architecture integrity evaluator" role を別立てし、Gate 前に PJ 跨ぎの整合を確認する運用

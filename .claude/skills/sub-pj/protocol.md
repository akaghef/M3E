# PJ 遂行プロトコル — 正本

sub-PJ の立ち上げから完了・反省までの唯一の参照ファイル。
個別 PJ の README はこのプロトコルに従って書く。

---

## 1. 採番・命名規約

- 通し番号: `PJ{NN}`（活性化順に連番）
- ブランチ: `prj/{NN}_{Name}`（例: `prj/02_MathOntoBridge`）
- ディレクトリ: `projects/PJ{NN}_{Name}/`
- 候補段階のラベル（`PJ-01` 等）は `backlog/meta-subpj-candidates.md` 内限定。活性化時に正式番号を振る

## 2. PJ 立ち上げチェックリスト

活性化の決定後、以下を **この順序で** 実行する。

1. **採番** — 次の空き番号を `backlog/meta-subpj-candidates.md` の表に登録
2. **ビジョン凝縮**（ユーザーと対話）
   - 何が痛いか（問題）
   - 半年後の完了像
   - 明示的に範囲外とするもの
   - ブレスト素材（idea/ 等）があっても PJ スコープとは別物。ここで絞る
3. **ディレクトリ作成** — `projects/PJ{NN}_{Name}/` に以下のサブディレクトリも作成:
   - `idea/` — PJ 内で生まれたアイデア・メモ
   - `data/` — 入力データ・中間データ
   - `docs/` — 情報源・参考文献・調査メモ
   - `artifacts/` — PJ の成果物（生成物・出力）
4. **README 作成** — 下記「必須セクション」を埋める
5. **ブランチ作成** — `prj/{NN}_{Name}`（dev-beta から分岐）
6. **plan.md 作成** — Phase 分割と最初の Phase の具体タスク
7. **マップ登録** — DEV map（または専用マップ）に PJ ノードを追加

> **教訓**: ディレクトリ規約は PJ 初手で確認する。`docs/projects/` に作って移し直す手戻りを防ぐ。

## 3. README 必須セクション

```yaml
# frontmatter
pj_id: PJ{NN}
project: {Name}
date: {kickoff date}
status: active | paused | done
owner: akaghef
related: plan.md
```

| セクション | 内容 |
|---|---|
| **Vision** | 問題・完了像・スコープ（In / Out） |
| **主成果物** | 番号付きリスト（3 個以内が理想） |
| **メタ情報** | PJ名、ブランチ、worktree、マップ、kickoff 日、原典リンク |
| **ドキュメント構成** | plan.md、prior_art 等へのリンク |
| **役割分担** | 下記テンプレート |
| **運用ルール（要点）** | PJ 固有ルール。一般ルールはここで繰り返さない |
| **Future Work** | 範囲外だが将来やりたいもの |
| **進捗ログ** | 日付付き箇条書き |

## 4. 役割分担テンプレート

| 領域 | 人間（akaghef） | Claude | Codex（任意） |
|---|---|---|---|
| {領域1} | ◎ / 方針決定 / — | ◎ / 候補列挙 / — | ◎ / — |
| Phase 遷移判定 | **◎ 必ず人間** | × 勝手に進めない | — |

**Claude が止まって確認すべき境界** を README に明記すること。

### 一般ルール

- **実行フェーズは自動運転**: Gate 2 通過後の task 消化は、原則として人間の介入なしに連続実行する。task 完了 → 次の task へ自動で進め
- **エスカレーション基準**: 以下の場合のみ作業を止めてユーザーに報告する:
  - **Phase 遷移判定**（人間が判定する。Claude は「遷移可能と思う」と報告するまで）
  - **環境・前提の崩壊**: ツール不在、依存サービス停止、マップサーバーが壊れて起動不能など、回避策が大幅な遠回りになる場合
  - **スコープ逸脱**: plan.md の範囲を明らかに超える判断が必要な場合
- **それ以外は止まるな**: ambiguity は pool（§6 資源管理の判断負債ルール）、軽微な問題は回避して進め
- **facet / scope 跨ぎ操作**: マネージャー session が batch で行う。サブワーカーは facet 内に閉じる
- **scope をまたぐ link は張らない**: 異なる scope 間の関係は alias で示す。link は同一 scope 内でのみ使用する

### M3E runtime の標準形

M3E を実行画面として使う PJ は、原則として **1 つの master map を 3 scope に分けた runtime** を持つ。
人間の視界は次の 3 view + chat を標準とする:

1. **Progress Board**
   - task-management / dependency facet
   - PJ の現在地、phase、blocker、次 gate を示す
2. **Review**
   - reviews facet
   - 判断負債（Q / option / rationale）を batch review する
3. **Active Workspace**
   - document / implementation / dependency など実作業 facet
   - Board や Review の根拠へ drill-down する

運用上の原則:

- runtime は **既定で必須** とする。使わない場合のみ、README と plan.md の両方に
  `runtime_opt_out: {理由}` を明記して opt-out しろ
- 3 view は **別 map ではなく同一 master map の別 scope** を第一選択とする
- Progress Board は **summary であっても traceability 必須**。task ノードから Review / Workspace の現物へ alias で辿れること
- map から chat へ送信できない間は、review 完了や phase gate の通知は **人間が手動で chat に送る**
- ただし board の状態遷移（review → ready / blocked など）は、可能なら map 監視で自動更新してよい
- `次フェーズへ` は常に **人間 gate**。Claude は readiness を示すまで

## 5. Phase 管理

### Phase 分割の原則

- Phase 0 は「設計と最小検証」。実装量を最小に
- Phase 粒度は 1–2 週間で完了できるサイズ
- 後半 Phase は粗い粒度でよい。前の Phase の結果を見てから詳細化

### Phase 遷移ルール

1. Claude が遷移可能と判断 → 理由をユーザーに提示
2. ユーザーが承認 → README の進捗ログに記録
3. 次 Phase の plan.md タスクを具体化

## 6. 資源管理

PJ の遂行には成果物（コード、文書）だけでなく、判断・知見・状態といった**無形の資源**が不可欠である。
これらは放置すると散逸し、再構築コストが膨大になる。
M3E の Resource 概念（SSOT・型別振る舞い・参照パターン・ロールアップ）と同じ思想で、PJ 資源を管理する。

### 設計原則

- **SSOT（単一正本）**: 各資源は 1 箇所にのみ正本がある。他所からは参照だけする
- **型別の記録ルール**: 資源の種類ごとに「どこに」「いつ」「どう」記録するかが決まっている
- **止まるな**: 記録のために作業を中断しない。不確実なものは pool して進める
- **導出可能性**: PJ の現在状態は plan.md を読めば導出できる。冗長な複写を作るな
- **compaction 耐性**: auto compaction 後に PostCompact hook がリマインダーを注入する。進捗ログに作業サマリーを書き出せ

### 資源レジストリ

| 資源 | 正本の置き場所 | 記録トリガー |
|------|--------------|------------|
| **進捗ログ** | plan.md 進捗ログ | task 完了時、セッション終了時 |
| **確定事項** | plan.md 確定事項セクション | Gate 通過時。方針・技術選定・スコープ絞り込み |
| **却下した代替案** | plan.md 確定事項の直下 | 決定と同時に。理由を必ず付ける |
| **探索ログ** | plan.md 探索ログ | 情報収集・戦略立案の都度 |
| **判断負債** | マップ reviews/Qn ノード | 判断に迷った時。tentative default で進め、人間が batch review |
| **技術負債** | plan.md debt or PJ 固有 debt_register | 作業中に発見した時 |
| **アイデア・発見** | PJ内 idea/ or backlog/（tomd） | 作業中に思いついた時。PJ スコープ外 |
| **情報源** | plan.md 情報源 or PJ内 docs/ | 参考にした文献・コード・URL。出典と要点を記録 |
| **PJ 間依存** | plan.md 依存関係 | 他 PJ の成果を前提にする関係を発見した時 |
| **時間実績** | plan.md 進捗ログ（見積もり vs 実績） | task / Phase 完了時。将来の見積もり精度向上用 |
| **律速・障害** | plan.md 進捗ログ | 律速要因の発生・解消時。何に、どれだけ止まったか |
| **Phase 状態** | plan.md status + マップ phase_marker | Phase 遷移時 |
| **Agent Status** | マップ | セッション開始/終了、state 変化時 |
| **セッション会話ログ** | projects/PJ{NN}_{Name}/sessions/YYYY-MM-DD.md | セッション終了時に一括生成 |
| **PJ 反省** | projects/PJ{NN}_{Name}/retrospective.md | PJ 完了時 |
| **一般教訓** | projects/retrospective_general.md | 反省から一般化できた時 |

### M3E Resource との関係

この資源レジストリは M3E の Resource 設計（`docs/03_Spec/Resource_Design.md`）と同じパターンに従っている:

- 定義を 1 箇所に集約し、利用箇所からは参照する（SSOT）
- 資源の型ごとに振る舞いが異なる（DistributionRule ≒ 記録トリガー）
- 状態は非永続的に導出する（rollup ≒ plan.md からの状態導出）
- 超過は警告であり停止ではない（over-allocation warning ≒ ambiguity pool）

将来的に PJ 資源を M3E Resource として実装し、マップ上での可視化・ロールアップ・容量管理を実現する余地がある。現時点では plan.md + マップの運用規約で代替する。

## 7. 完了定義とハンドオフ

### タスク完了

タスクは以下がすべて揃って完了:
1. 変更がコミットされている
2. 進捗ログが更新されている（README または plan.md）
3. マップの Agent Status が更新されている

### セッション終了ハンドオフ

報告フォーマット:
1. 何を変更したか
2. 何を検証したか
3. 次の具体タスク 1 つ

### PJ 完了

- 全 Phase 完了（または意図的な中断決定）
- retrospective.md の作成（個別 PJ 用）
- retrospective_general.md への一般教訓の抽出
- README の status を `done` に変更
- `backlog/meta-subpj-candidates.md` の表を更新

## 8. 反省フロー

```
PJ 実行中の気づき
  → projects/PJ{NN}_{Name}/retrospective.md（個別 PJ の反省）
  → projects/retrospective_general.md（一般化できる教訓を抽出）
  → この protocol.md のルール改訂（十分に検証されたパターンのみ）
  → backlog/app-feature-gaps.md（M3E 本体への機能要求を抽出）
```

- 反省は「ルール化」と「一般論としての記録」と「M3E 機能要求」を分ける
- protocol.md に昇格するのは、2 回以上の PJ で確認されたパターンのみ
- M3E 機能要求は PJ 完了時に retrospective.md から抽出し、devM3E / sort-task で優先順位付け

## 9. ブランチ・操作ポリシー

- `dev-*` / `prj/*` ブランチ: create/switch/stage/commit/push は autonomous
- 要確認: reset --hard, force-push, history rewrite, `main` への操作, secrets
- `dev-beta-visual` / `dev-beta-data` は **削除禁止**（Codex ロールの作業領域）

## 10. 言語ポリシー

| 場面 | 言語 |
|---|---|
| Agent ↔ ユーザー会話 | 相手の言語に合わせる |
| 設計・仕様・ADR ドキュメント | 日本語 |
| コード識別子・ファイル名 | 英語 |
| コミットメッセージ | 英語（Conventional Commits 推奨） |

---

## 改訂履歴

- 2026-04-17: 初版。PJ01/PJ02 の実績と retrospective_general.md の教訓を統合して策定

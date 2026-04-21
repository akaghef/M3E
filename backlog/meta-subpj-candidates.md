# Meta sub-PJ 候補（M3E 自体の向上）

## ナンバリング規約

> **正本**: [projects/META.md](../projects/META.md) §1–§2 を参照。以下は要約。

- 通し番号 `PJ{NN}`、ブランチ `prj/{NN}_{Name}`、ディレクトリ `projects/PJ{NN}_{Name}/`

### ブランチ・ディレクトリ規約

- **ブランチ**: `prj/{NN}_{Name}` （例: `prj/02_MathOntoBridge`）
- **作業ディレクトリ**: `projects/PJ{NN}_{Name}/` （`projects/` 配下に統一）

| ID | 名称 | 状態 | 場所 |
|---|---|---|---|
| `PJ00` | M3E 本体 | 継続中 | このリポジトリ全体 |
| `PJ01` | AlgLibMove | 進行中 (prj/AlgLibMove ブランチ) | `projects/PJ01_AlgLibMove/` |
| `PJ02` | MathOntoBridge | 進行中 (prj/02_MathOntoBridge ブランチ、列挙番号 PJ-101) | `projects/PJ02_MathOntoBridge/` |
| `PJ03` | SelfDrive | 進行中 (2026-04-21 reopen、Plan 1 は基礎工事完了、Plan 2 で graph runtime 実体を追加) | `projects/PJ03_SelfDrive/` |
| `PJ04+` | 未定 | - | 活性化時に `projects/PJ{NN}_{Name}/` を作成 |

本ファイル下部の候補一覧（TrustEng 以下）は **未活性の候補ラベル**。活性化判断時に次の連番 (`PJ02` 以降) を採番し直す。以下の `PJ-01` 〜 `PJ-07` は暫定的な候補識別子として本ファイル内でのみ使用する。

## 背景・コンセプト

- **最優先課題**: 半自動化。品質を落とさずにエージェント主導開発を回す。
- **手段**:
  - **ゲート** を設ける（本質的決定だけ人間が下す）
  - ゲートで正しい判断ができるよう **情報収集を徹底**
  - **クリティカルパスを極限まで削減**
- **運用単位**: sub-PJ。M3E PJ 内に複数立ち上げ、将来は並列で回す。
- **並列は未来の話**。今は1本ずつ形を固める。
- **先行事例**: AlgLibMove を最初の sub-PJ として実行済み（dogfood 型）。

## 横串で効く原理

信用 × セキュリティ × 開発効率化は **不可分**（開発観点）。

- 権限を絞りすぎる → 人間確認で律速
- 権限を広げる → 壊される・秘密漏れ・全行レビュー必須で結局律速
- 信用 = track record + ガードレールの質
- ガードレール設計が粒度高ければ autonomous に任せられ効率↑

関連アイデア（既コミット）:
- `idea/00_meta/automation_obstacles/` — 障害40+、解決パターン20（P2段階自動化/P5検証/P10レイヤ分離/P15アンドゥ/P16人間最終判断）
- `idea/00_meta/meta_m3e/` — dogfood, 自己改善ループ, feedback/telemetry, plugin/fork

## Meta sub-PJ 候補 7本

### PJ-01. 信用工学 (TrustEng)
**目標**: エージェントに autonomy を渡しても壊れない・戻せるガードレール整備。
- 権限スコープ細分化（worktree隔離、ブランチ保護、ツール別許可）
- 全操作の audit log と可逆性（1キー undo）
- レビューキュー基盤（keyboard_modes 連動）
- 段階的自動化レベル（L0〜L4）をノード属性化

### PJ-02. 自己改善ループ (SelfImprove)
**目標**: 改善要望 → AI 設計 → 承認 → 実装のサイクルを M3E 内で閉じる。
- scratch → 改善提案ノード型への昇格フロー
- 提案ノードに impact / effort / risk 属性
- 採用ゲート（人間判断）の定位置化
- 実装後の「効いたか」自動検証メモ

### PJ-03. ドッグフード深化 (DogfoodDeep)
**目標**: M3E 開発そのもの（PR / Issue / agent状態）を M3E マップで運営する。
- DEV map を PR/Issue の mirror に
- agent status の自動同期
- 作業ログの provenance 標準化
- マップから直接 PR コメント・マージ承認

### PJ-04. 情報収集基盤 (InfoGather)
**目標**: ゲートで本質的決定をするための情報が、決定直前に自動集約される。
- ノード型テンプレ（決定前に埋めるべき欄）
- 外部ツールからの自動リンク吸収
- 未決論点プール（review / Qn の束）
- RAG / 履歴横断検索

### PJ-05. 観察・自己定量 (ObserveSelf)
**目標**: 自分がどこに時間・思考を使ったかを M3E が勝手に見せる。
- マップ操作の自動集計（insights 発展）
- 週次・月次レビュー UI
- 自己欺瞞検出（作業ログ vs 成果ノード）
- Hawthorne 効果を抑える匿名化オプション

### PJ-06. プライバシーレイヤ (PrivacyLayer)
**目標**: 機密ノードがプレーンで残らないことを構造的に保証する（policy_privacy 具現化）。
- vault の機微度レイヤ分離
- 暗号ノード型（クライアントサイド暗号化）
- AI 送信時の自動マスキング／送信可否判定
- 鍵管理 UI

### PJ-07. 射影パイプライン (Projection)
**目標**: マップ（世界モデル）から申請書体裁の出力をワンボタンで（project_projection_vision 具現化）。
- 出力テンプレ（科研費・報告書）のノード型化
- マップ → 構造化中間表現
- 引用・出典の自動付与
- 人間校閲 UI（最終責任ゲート）

## 依存関係メモ

- **PJ-01 は他全PJの前提** — gate 粒度を規定する
- **PJ-04 は PJ-02 / PJ-07 の substrate** — 情報集約が決定を支える
- **PJ-06 は PJ-07 の前提** — 機密を出力に混ぜない保証

## 未決論点

- ~~sub-PJ を「形式」として固めるか~~ → **決定済**: `projects/PJ{NN}_{Name}/` に統一、ブランチは `prj/{NN}_{Name}`
- M3Eマップ上の sub-PJ 表現（strategy board レーン / 独立マップ）
- 次に立てる sub-PJ の選定 — PJ-01 を基盤として先行するか、PJ-02 の自己改善ループを回しながら育てるか

*2026-04-16*

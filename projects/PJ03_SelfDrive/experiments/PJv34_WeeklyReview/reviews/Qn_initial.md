# Qn Initial — PJv34 WeeklyReview

## Qn1. Secret 解決の責務境界

### 問い

Bitwarden CLI から DeepSeek API key を取得する責務を、起動レイヤに置くか、orchestration layer の `SecretProvider` に置くか。

### Option A: 起動レイヤで env 注入

- pros: アプリ本体が Bitwarden CLI に依存しない。既存 `AI_Infrastructure.md` の推奨と整合。
- cons: orchestrator 単体テスト時に注入手順が別途必要。

### Option B: SecretProvider が Bitwarden CLI を呼ぶ

- pros: self-driving loop 内で secret source を抽象化しやすい。
- cons: CLI 呼び出し、unlock 状態、timeout、ログ漏れ対策をアプリ側で抱える。

### Tentative Default

Option A を第一候補にする。ただし `SecretProvider` interface は残し、env provider と bitwarden-cli provider の両方を実装可能にする。

## Qn2. 週次レビュー入力の範囲

### 問い

Phase 0 の weekly review input に daily / git / map / task のどこまで含めるか。

### Tentative Default

Phase 0 は模擬 JSON のみ。Phase 1 以降で daily と task、Phase 2 で map を接続する。

## Qn3. proposal 保存先

### 問い

生成した review proposal を最初から map reviews/Qn に書くか、artifacts JSON に置くか。

### Tentative Default

Phase 0 は `artifacts/` に JSON。Phase 2 で map reviews/Qn へ接続する。

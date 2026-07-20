# Runtime Board 動画再現 — 検証資料

## Why

参照動画から再現した Runtime Board の表示・操作要件を、実装用 worktree を削除した後も比較可能な形で残す。これは製品仕様ではなく、将来の viewer / Agent Status 表示を検討するための idea evidence である。

## 再現した要素

- 暗色の密な graph とカテゴリ別の node 表現
- 処理 step ごとの active / completed 表示
- 前後移動・自動再生を行う playback controls
- node 選択時に API 風の詳細を示す drawer
- legend、minimap、step overlay を同時に表示する情報設計

## Evidence

- [`runtime-board.png`](./runtime-board.png): 1440×900でstep 5まで進めた画面
- [`verification.md`](./verification.md): 自動検証の対象と結果
- [`runtime-board-implementation.patch`](./runtime-board-implementation.patch): 再現実装を復元・比較するための差分

## Provenance

- `codex/runtime-board-video-repro`: Runtime Boardを参照動画に近い操作可能な画面として再現するための作業系統。
- `9701752`: graph、playback、drawer、minimapとPlaywright検証を追加した変更。
- 取得日: 2026-07-20

## Open Questions

- Agent Statusへ採用する場合、常時表示する情報と詳細drawerへ退避する情報をどう分けるか。
- playbackは実runtime eventのreplayに接続するか、説明用simulationに限定するか。
- minimapとstep overlayが狭い画面で競合しない最低viewportをどこに置くか。

## Next Action

S2の実runtime観測要件が確定した時点でこの証拠を比較対象にし、必要な表示パターンだけを新しい実装へ移植する。

Related: `S2` Team Collaboration / `S3` 保存・同期・復元

# 運用・競合・復旧

## Completion evidence

同期UIの成功表示だけでは完了にしない。

- POST / proposal result
- subsequent GET / source reread
- source revision
- node / edge count
- deterministic digest
- audit / journal entry

## Conflict policy

last-write-winsを既定にしない。`base / current / proposed`のthree-way比較を行い、stale baseは人間確認へ送る。

## Failure classes

- auth
- schema
- reference / cycle
- conflict / stale revision
- transport
- quota / plan limit
- partial write
- render / macro

今回のブラウザ検証では、無料プランの全体まとめ数上限が新規project importを止めた。これはJSON schema failureと区別すべきquota / plan failureである。

## Recovery

- source-owned record: canonical sourceからRebuild Gateを通す。
- M3E-owned accepted record: portable snapshot + journal replayでRecovery Gateを通す。
- Memoforest Time Machineはsource-side local recoveryであり、M3E Recovery Gateの代替ではない。
- deleteは即時物理伝播ではなくtombstoneと保留期間を検討する。


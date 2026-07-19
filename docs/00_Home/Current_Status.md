# Current Status

最終更新: 2026-07-19

この文書は、**今後数日でどの `S*` を主戦場にしているか**を示す短期の戦略スナップショット。
履歴・運用ルール・詳細ロードマップ・具体 task は別ドキュメントへ分離する。

**この文書に書いてよいもの**

- active な `S*` とその進み具合
- Strategy 単位の blocked / risk
- 次に主戦場になる `S*`

**この文書に書いてはいけないもの**

- `P*` / Principle の本文
- `V*` / Vision の本文
- 具体的な task list
- handoff の詳細
- 実装ログや作業日記
- 仕様本文

---

## 状態

- 開発対象: `beta/`
- MVP Phase 1〜4: 完了（読み取り・編集・描画・保存が動作中）
- 主戦場: `S2` Team Collaboration を最優先の突破口にする
- 最新リリース: `main` / tag `v260419-2`
- データバージョン: v1（schema version 1）

## Active Strategy (Next Few Days)

### S2. Team Collaboration を最優先の突破口にする

- 状態: 実装中（主戦場に復帰）
- 現在地: エンティティ登録・scope lock・SSE は完了。scope push を詰めている
- 数日内の焦点: Command Language の 3 平面整列（語彙先行）を前置きし、Phase 2（conflict backup, エンティティ UI, 監査ログ）へ進む。S2 はチーム並列のデータ蓄積装置であり、S16 の authority / Command 境界の実証場を兼ねる。**最初の実チーム = Swingby（人力飛行機）の知識マップ作成**

### S3. 保存・同期・復元の信頼性を先に固める

- 状態: 並走中
- 現在地: Cloud Sync 競合 UI 改善、data runtime / distribution 経路の整理を継続
- 数日内の焦点: 仕様は 3 平面語彙（読み=openCypher/GQL、書き=Command intent、精錬=materialize/derive）で記述し、ad-hoc 用語を導入しない

### S16. 局所正本の連邦化（収穫モード）

- 状態: **実装凍結・収穫モード**。Phase 0 正典化（ADR 008 / PR #75）と Phase 1 specimen（PR #77、検証合格・merge 済み）まで完了
- 現在地: UC-A（agent/CI が repo-local semantic source を file read で消費）は製品レベルで実証済み
- 数日内の焦点: Phase 2（indexer / policy gate / proposal journal）は Demand Gate（実需 cross-source query 3 件）が開くまで着手しない。数学オントロジーは長期線とし、近期の query 採取は Swingby チーム運用（下記 S2）から行う

### S13. 外部インフラやプロバイダに依存しすぎない経路を維持する

- 状態: 継続監視
- 現在地: dev branch 統合を `dev-beta` に集約し、`final/` へ同期済み。legacy 経路削除、runtime 経路整理は継続
- 数日内の焦点: beta/final の運用導線を単純化し、依存経路を減らす

## Blocked / Risk

- `S3`: role 違反を機械的に止める CI チェック未導入
- `S3`: セキュリティ検討 4 件（CSRF, LAN 露出, エージェント偽装, 入力バリデーション）は Todo Pool で blocked 管理
- `S2` / `S3`: Team Collaboration まわりは push / conflict / UI / audit が相互依存しやすい
- 解消済みメモ: SQLite ロック問題は API 経由で回避済み

## Next Strategy Focus

1. Command Language 3 平面整列（Glossary 対応表含む）を確定する — S2/S3 仕様の語彙前提
2. `S2` Team Collaboration Phase 2（conflict backup, 監査ログ）へ進む
3. `S3` branch-role ゲートと Stage A テストを導入する
4. `S16` 数学オントロジー specimen へのコンテンツ投入と Demand Gate query 採取
5. `S4` Linear↔Tree L1 最小実装と round-trip テストへ接続する

---

## 別の場所を見るべきもの

| 知りたいこと | 参照先 |
|-------------|-------|
| 最近何が変わったか | [../daily/](../daily/) |
| Strategy の正本 | [../01_Vision/Strategy.md](../01_Vision/Strategy.md) |
| 具体 task / handoff | [../tasks/](../tasks/) |
| TODO プール | [../06_Operations/Todo_Pool.md](../06_Operations/Todo_Pool.md) |
| 統合フロー・branch 運用 | [../06_Operations/Worktree_Separation_Rules.md](../06_Operations/Worktree_Separation_Rules.md) |
| リリース履歴 | [../06_Operations/Version_Registry.md](../06_Operations/Version_Registry.md) |
| Team Collaboration 仕様 | [../03_Spec/Team_Collaboration.md](../03_Spec/Team_Collaboration.md) |

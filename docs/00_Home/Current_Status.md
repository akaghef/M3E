# Current Status

最終更新: 2026-09-14

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
- 主戦場: `S17` OT を合併吸収し、個人ツールとしての一枚絵運用を成立させる
- 最新リリース: `main` / tag `v260419-2`
- データバージョン: v1（schema version 1）

## Active Strategy (Next Few Days)

### S17. OT を合併吸収し、個人ツールとしての一枚絵運用を主戦場にする

- 状態: **主戦場へ昇格。Strategy 化済み、統合境界の確定前**
- 現在地: OT は OSS として backend / observation / lineage / communication / history / replay が稼働している。M3E 側では ADR_011 に意味境界があり、OT→M3E connector と Goal / Task / Resource への binding は未実装
- 数日内の焦点: OT の observation contract と M3E map data seam を確定し、`Goal / Task — Agent — お金 / machine` を同一 PJ graph で結ぶ最初の thin slice を設計する。成功基準は複数人対応ではなく、Akaghef 個人の注意 1 単位あたりに成立する仕事量

### S2. Team Collaboration の一般解を保留する

- 状態: **主戦場から保留へ移行**
- 現在地: エンティティ登録・scope lock・SSE までの成果は保持する
- 再開条件: Akaghef 個人の複数 PC + 常駐 mac mini + agent 群で identity / authority / sync / conflict / recovery が実運転でき、複数人へ一般化する具体的需要が生じること

### S3. 保存・同期・復元の信頼性を先に固める

- 状態: 並走中
- 現在地: Cloud Sync 競合 UI 改善、data runtime / distribution 経路の整理を継続
- 数日内の焦点: 仕様は 3 平面語彙（読み=openCypher/GQL、書き=Command intent、精錬=materialize/derive）で記述し、ad-hoc 用語を導入しない

### S16. 局所正本の連邦化（収穫モード）

- 状態: **実装凍結・収穫モード**。Phase 0 正典化（ADR 008 / PR #75）と Phase 1 specimen（PR #77、検証合格・merge 済み）まで完了
- 現在地: UC-A（agent/CI が repo-local semantic source を file read で消費）は製品レベルで実証済み
- 数日内の焦点: Phase 2（indexer / policy gate / proposal journal）は Demand Gate（実需 cross-source query 3 件）が開くまで着手しない。S17 の Agent / Goal / Task / Resource 横断 query を実需候補として採取する

### S13. 外部インフラやプロバイダに依存しすぎない経路を維持する

- 状態: 継続監視
- 現在地: dev branch 統合を `dev-beta` に集約し、`final/` へ同期済み。legacy 経路削除、runtime 経路整理は継続
- 数日内の焦点: beta/final の運用導線を単純化し、依存経路を減らす

## Blocked / Risk

- `S3`: role 違反を機械的に止める CI チェック未導入
- `S3`: セキュリティ検討 4 件（CSRF, LAN 露出, エージェント偽装, 入力バリデーション）は Todo Pool で blocked 管理
- `S17`: OT upstream contract と M3E の Role / Actor Instance / Telemetry 語彙を直接同一視すると semantic dual-canon になる
- `S17`: 常駐 mac mini を active host として使えても、単一障害点化せず portable recovery を維持する必要がある
- `S17`: Agent dashboard の移植に縮退すると、Goal / Knowledge / Resource / attention を同じ面で扱う最遠目標から外れる
- 解消済みメモ: SQLite ロック問題は API 経由で回避済み

## Next Strategy Focus

1. `S17` OT の backend / observation contract と M3E connector seam の責任境界を確定する
2. `S17` 最初の thin slice（Goal / Task — Agent — Resource）の node / typed edge / authority contract を確定する
3. `S17` 個人 multi-PC + 常駐 mac mini の active-host / event catch-up / recovery 境界を確定する
4. `S3` 保存・同期・復元を S17 の安全条件として並走させる
5. `S16` S17 から実需 cross-source query を採取し、Demand Gate を判定する

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

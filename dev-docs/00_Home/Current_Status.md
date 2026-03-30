# Current Status

## Documentation Operation Update (2026-03-30)

- Added `06_Operations/Decision_Pool.md` as the intake point for conversation decisions
- Added `06_Operations/Documentation_Rules.md` for documentation handling rules
- Future conversation decisions should be recorded there before promotion to formal docs

## 現在の結論

M3E は現在、Freeplane を参考にしつつ、
描画エンジンと操作系は独自実装する方針に切り替えた。
Freeplane は参考実装および `.mm` 互換入力形式として扱い、
M3E 自身が研究思考支援に適した表示と操作を持つ。

独自実装の前提も次のように固定する。

- UI 基盤は React コンポーネントで構成する
- 思考マップ描画は独立したレンダリング層として分離する
- 初期描画は SVG 先行でよい
- レイアウト、モデル、描画の境界は最初から分ける

## いま固定されていること

- 利用環境は Mac 上の個人利用が前提
- Freeplane は参考実装および `.mm` 互換入力形式として扱う
- 描画と操作は M3E 側で自作する
- Flash / Rapid / Deep の三層運用は維持する
- AI は MVP の対象外とし、後続フェーズで扱う
- データ消失を避けることが最優先
- UI 基盤は React を優先する
- コアロジックはフレームワーク非依存の TypeScript に寄せる
- 主対象は科学研究の思考過程である

## まだ固定していないこと

- Freeplane 連携をファイルベースにするか API/スクリプトベースにするか
- AI 連携をどのフェーズで再開するか
- Deep の差分比較をいつ実装するか
- 描画面を Canvas と SVG のどちらで実装するか
- autosave と保存形式をどう分けるか

## いま優先する成果

1. Freeplane `.mm` の構造を読み取れること
2. 独自描画面で基本表示と基本編集が成立すること
3. 本当に簡単に操作可能な導線を作ること
4. 日常運用で破綻しないこと

## 次に読む文書

- 方針の理由: [../02_Strategy/Current_Pivot_Freeplane_First.md](../02_Strategy/Current_Pivot_Freeplane_First.md)
- MVP の定義: [../02_Strategy/MVP_Definition.md](../02_Strategy/MVP_Definition.md)
- 採用判断の記録: [../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)
- UI 基盤の判断: [../09_Decisions/ADR_002_React_UI_Basis.md](../09_Decisions/ADR_002_React_UI_Basis.md)

## ドキュメント拡張 To-Do (2026-03-30)

### 優先度 A (今週)

- [ ] 今週の目標: Rapid MVP を実装する
- [ ] Rapid-1: `.mm` 読み取りと M3E 最小モデル変換を通す
- [ ] Rapid-2: ノード追加/編集/削除を実装する
- [ ] Rapid-3: 再親付けと折り畳み/展開を実装する
- [ ] Rapid-4: Undo/Redo を実装する
- [ ] Rapid-5: 保存前検証、保存、再読込を実装する
- [ ] Rapid-6: 選択可視化、パン、ズームを実装する
- [ ] Rapid-7: 5 分操作テスト (初見) を実施する
- [ ] Rapid-8: 500 ノード性能テストを実施する
- [ ] Rapid-9: MVP 判定 (追加/編集/削除/再配置/保存が迷わず完了)

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

- [ ] 今週の目標: MVP を作る (進行中)
- [ ] Phase 1: 読み取り基盤
- [ ] Freeplane `.mm` 入力を最小実装する
- [ ] ノード階層パーサを実装する
- [ ] M3E 最小モデルへ変換する
- [ ] 循環、欠損親、重複 ID の整合性チェックを実装する
- [ ] 受け入れ確認: サンプル 10 マップをクラッシュなしで読み取る
- [x] Phase 2: コア編集機能 (モデル層)
- [x] ノード追加を実装する
- [x] ノード編集を実装する
- [x] ノード削除を実装する
- [x] 再親付けを実装し、循環を禁止する
- [x] Undo/Redo を実装する
- [ ] 受け入れ確認: 連続 30 回の Undo/Redo で状態破綻しない (先送り)
- [x] Phase 3: コア表示機能 (最小ビューア)
- [x] ノードと親子エッジの基本描画を実装する
- [x] 選択ノードの可視化を実装する
- [ ] パン、ズーム、ノード中心移動を実装する
- [ ] 500 ノード規模で最低性能を確認する
- [x] 独自描画面の上で基本編集が成立することを確認する (追加/編集/削除)
- [x] Phase 4: 保存と保護 (最小)
- [x] 保存形式に version を付与する
- [x] 保存前検証を実装する
- [ ] バックアップ保存を実装する
- [x] 保存 -> 再読込で同一構造になることを確認する
- [ ] Phase 5: 操作性の最終調整
- [ ] 主要操作の導線を短くする
- [x] 操作ラベルと状態表示を整理する (viewer)
- [ ] 初見ユーザーで基本操作が完了できることを確認する

### 直近追加タスク (Rapid MVP)

- [x] 一コマンド起動を実装する (`node mvp/start_viewer.js`)
- [x] 参考画像ベースの見た目調整を反映する
- [x] ノード座標計算を幅・サブツリー高さベースへ修正する
- [x] ビューア上の直接編集 (追加/編集/削除/折り畳み) を実装する
- [ ] ビューア上の再親付けを実装する

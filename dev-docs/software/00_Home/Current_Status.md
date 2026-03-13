# Current Status

## 現在の結論

M3E は現在、独自マインドマップエディタ開発を主目標にしない。  
既存の思考整理環境として Freeplane を採用し、その外側で論点整理・構造変換・AI 提案を行う、科学研究中心の思考支援層として検証する。

独自実装を進める場合の前提も更新する。  
アプリケーション全体を Canvas 中心で組むのではなく、UI 基盤は React コンポーネントで構成し、思考マップ描画は独立したレンダリング層として分離する。

## いま固定されていること

- 利用環境は Mac 上の個人利用が前提
- 当面の主戦場は Freeplane ベース
- Flash / Rapid / Deep の三層運用は維持する
- AI は提案までで、採用は人間が決める
- データ消失を避けることが最優先
- UI 基盤は React を優先する
- コアロジックはフレームワーク非依存の TypeScript に寄せる
- 主対象は科学研究の思考過程である

## まだ固定していないこと

- 独自エディタをいつ再開するか
- Freeplane 連携をファイルベースにするか API/スクリプトベースにするか
- AI 提案の粒度をどこまで自動化するか
- Deep の差分比較をいつ実装するか
- 描画面を Canvas と SVG のどちらで実装するか

## いま優先する成果

1. Freeplane 上の構造を読み取れること
2. 構造を研究論点や比較軸に変換できること
3. その結果が科学研究を実際に加速すること
4. 日常運用で破綻しないこと

## 次に読む文書

- 方針の理由: [../02_Strategy/Current_Pivot_Freeplane_First.md](../02_Strategy/Current_Pivot_Freeplane_First.md)
- MVP の定義: [../02_Strategy/MVP_Definition.md](../02_Strategy/MVP_Definition.md)
- 採用判断の記録: [../09_Decisions/ADR_001_Freeplane_First.md](../09_Decisions/ADR_001_Freeplane_First.md)
- UI 基盤の判断: [../09_Decisions/ADR_002_React_UI_Basis.md](../09_Decisions/ADR_002_React_UI_Basis.md)

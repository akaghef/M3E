# M3E Software Docs

このディレクトリは、M3E のソフトウェア設計を「入口」「思想」「戦略」「仕様」「アーキテクチャ」「外部連携」「意思決定」に分けて整理したものです。

## 読み順

1. [00_Home/Home.md](./00_Home/Home.md)
2. [00_Home/Current_Status.md](./00_Home/Current_Status.md)
3. [01_Vision/Core_Principles.md](./01_Vision/Core_Principles.md)
4. [02_Strategy/Current_Pivot_Freeplane_First.md](./02_Strategy/Current_Pivot_Freeplane_First.md)
5. [02_Strategy/MVP_Definition.md](./02_Strategy/MVP_Definition.md)
6. [03_Spec/Data_Model.md](./03_Spec/Data_Model.md)
7. [03_Spec/Scope_and_Alias.md](./03_Spec/Scope_and_Alias.md)
8. [03_Spec/Band_Spec.md](./03_Spec/Band_Spec.md)
9. [04_Architecture/MVC_and_Command.md](./04_Architecture/MVC_and_Command.md)
10. [04_Architecture/Drag_and_Reparent.md](./04_Architecture/Drag_and_Reparent.md)
11. [05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](./05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
12. [09_Decisions/ADR_001_Freeplane_First.md](./09_Decisions/ADR_001_Freeplane_First.md)

## ディレクトリ構成

- `00_Home`: 全体像と現在地
- `01_Vision`: プロダクトの原則
- `02_Strategy`: 現在の進め方と MVP
- `03_Spec`: ドメイン仕様
- `04_Architecture`: 実装構造と操作設計
- `05_Freeplane_Integration`: Freeplane を土台にする際の写像
- `09_Decisions`: ADR

## 文書設計の方針

- `Vision` は変わりにくい原則を書く
- `Strategy` は現時点の方針と優先順位を書く
- `Spec` は実装に依存しないドメイン制約を書く
- `Architecture` は UI/状態管理/コマンドの責務分離を書く
- `Decisions` は採用済み判断の理由と影響を書く

## 元メモ

この構成は以下の既存メモを再編成したものです。

- `dev-docs/M3E仕様設計書.md`
- `dev-docs/M3E仕様2.md`
- `dev-docs/DragOperate.md`
- `dev-docs/freeplane利用について.txt`

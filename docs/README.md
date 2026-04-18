# M3E Software Docs
## Added Operations Area (2026-03-30)

- `06_Operations/README.md`
- `06_Operations/Decision_Pool.md`
- `06_Operations/Documentation_Rules.md`
- `06_Operations/Commit_Message_Rules.md`

会話で決まったことは、まず `06_Operations/Decision_Pool.md` に記録する。
仕様として固まったら `03_Spec` `04_Architecture` `09_Decisions` に昇格する。

このディレクトリは、科学研究を中心とした思考ツールとしての M3E のソフトウェア設計を、「入口」「思想」「戦略」「仕様」「アーキテクチャ」「外部連携」「意思決定」に分けて整理したものです。  
現行方針と旧方針を混在させないため、廃止済み前提は `legacy/` に分離しています。

## 読み順

1. [00_Home/Home.md](./00_Home/Home.md)
2. [00_Home/Current_Status.md](./00_Home/Current_Status.md)
3. [01_Vision/Core_Principles.md](./01_Vision/Core_Principles.md)
4. [02_Strategy/Current_Pivot_Freeplane_First.md](./02_Strategy/Current_Pivot_Freeplane_First.md)
5. [03_Spec/Data_Model.md](./03_Spec/Data_Model.md)
6. [03_Spec/Scope_and_Alias.md](./03_Spec/Scope_and_Alias.md)
7. [03_Spec/Cloud_Sync.md](./03_Spec/Cloud_Sync.md)
8. [03_Spec/Band_Spec.md](./03_Spec/Band_Spec.md)
9. [04_Architecture/MVC_and_Command.md](./04_Architecture/MVC_and_Command.md)
10. [04_Architecture/Drag_and_Reparent.md](./04_Architecture/Drag_and_Reparent.md)
11. [05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](./05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
12. [06_Operations/Test_and_CICD_Guide.md](./06_Operations/Test_and_CICD_Guide.md)
13. [09_Decisions/ADR_001_Freeplane_First.md](./09_Decisions/ADR_001_Freeplane_First.md)
14. [09_Decisions/ADR_002_React_UI_Basis.md](./09_Decisions/ADR_002_React_UI_Basis.md)

## ディレクトリ構成

- `00_Home`: 全体像と現在地
- `01_Vision`: プロダクトの原則
- `02_Strategy`: 現在の進め方
- `03_Spec`: ドメイン仕様
- `04_Architecture`: 実装構造と操作設計
- `05_Freeplane_Integration`: Freeplane を土台にする際の写像
- `09_Decisions`: ADR
- `legacy`: 現行では採用しない旧設計要件

## 文書設計の方針

- `Vision` は変わりにくい原則を書く
- `Strategy` は現時点の方針と優先順位を書く
- `Spec` は実装に依存しないドメイン制約を書く
- `Architecture` は UI/状態管理/コマンドの責務分離を書く
- `Decisions` は採用済み判断の理由と影響を書く
- `legacy` は歴史的経緯の保管場所であり、現行実装方針ではない

## 元メモ

この構成は以下の既存メモを再編成したものです。

- `docs/M3E仕様設計書.md`
- `docs/M3E仕様2.md`
- `docs/DragOperate.md`
- `docs/freeplane利用について.txt`

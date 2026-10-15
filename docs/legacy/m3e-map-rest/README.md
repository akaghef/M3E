# M3E Map REST手順の履歴

旧 `m3e-map` SkillをMCPへ移行した際の保存資料。ここはSkillカタログでも現行の実行経路でもない。元の手順・例・補助スクリプトは履歴として保持し、`SKILL.md` は置かず、スクリプトは実行しない `.txt` に保存する。

現行の操作は [MCPによるMap操作](../../protocols/mcp-map-operations.md)、意味と不変条件は [Data Model](../../03_Spec/Data_Model.md)、未決の構造判断は [Map Manager](../../protocols/map-manager/README.md) を参照する。REST全状態編集、一時書込スクリプト、AgentによるNode ID生成、成功後の必須再GET、自動再着色を現行手順へ持ち込まない。

旧参照資料のfacet別の例、display intentの例、表示用metadataの案も削除せず保存した。現行語彙に沿った任意のmetadata規約は [Data Model](../../03_Spec/Data_Model.md)、文脈別の構造・anchor・色の例は [Map Manager](../../protocols/map-manager/README.md) に保持しており、両文書はMCP Resourcesから参照できる。旧資料はこれらの正規仕様とユーザーの明示制約に優先せず、一般CRUDの前提にしない。

`sort-task-render_map.mjs.txt` は旧SortedTaskView REST writerの履歴。現行の `sort-task` はMCPの対応範囲を確認し、不足する操作を報告する。

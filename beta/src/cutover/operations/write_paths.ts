import type { CommandIntent, CommandTargetKind } from "./command";

/**
 * beta の保存入口。草案 draft-write-path-commands.md は未承認なので写していない。
 * 錨点は 2026-11-11 時点の関数名。行番号は使わない。
 * 起動時の ensureMap は、map が既にあるとき text を上書きせず return する
 * （start_viewer.ts ensureMap）。草案が書いた「起動のたび rename」は現行にはない。
 */

export type WritePathCategory =
  | "ブラウザ保存"
  | "MCP"
  | "import"
  | "linear-text"
  | "GraphLink"
  | "Vault"
  | "collab"
  | "cloud"
  | "backup restore"
  | "Home"
  | "起動時";

/**
 * ここで定義: 「対応」は、その入口を Glossary / Command_Language の intent を持つ
 * Command（列を含む）へ変換できること。「未対応」は、その語に収まらないこと。
 */
export type WritePathDisposition = "対応" | "未対応";

interface WritePathBase {
  id: string;
  category: WritePathCategory;
  anchor: string;
  note: string;
}

export interface MappedWritePath extends WritePathBase {
  disposition: "対応";
  intents: readonly CommandIntent[];
  targetKind: CommandTargetKind;
  requiredPayload: readonly string[];
  /**
   * finishGrab のように、親の変更と兄弟順が同じ確定関数に乗っているとき。
   * payload.relation が intents のいずれかであること。
   */
  selectIntent?: "relation" | "action";
  /** whole-state と linear-text の Apply は、入力の差分から Command 列を作る。 */
  decompose?: "whole-state" | "linear-apply" | "group";
}

export interface UnsupportedWritePath extends WritePathBase {
  disposition: "未対応";
  reason: string;
}

export type WritePath = MappedWritePath | UnsupportedWritePath;

const mapped = (
  id: string,
  category: WritePathCategory,
  anchor: string,
  intents: readonly CommandIntent[],
  targetKind: CommandTargetKind,
  requiredPayload: readonly string[] = [],
  note = "",
  selectIntent?: "relation" | "action",
  decompose?: "whole-state" | "linear-apply" | "group",
): MappedWritePath => ({
  disposition: "対応",
  id,
  category,
  anchor,
  intents,
  targetKind,
  requiredPayload,
  note,
  ...(selectIntent ? { selectIntent } : {}),
  ...(decompose ? { decompose } : {}),
});

const unsupported = (
  id: string,
  category: WritePathCategory,
  anchor: string,
  reason: string,
): UnsupportedWritePath => ({
  disposition: "未対応",
  id,
  category,
  anchor,
  note: reason,
  reason,
});

export const WRITE_PATHS: readonly WritePath[] = [
  mapped("browser.add-child", "ブラウザ保存", "viewer.ts addChild", ["assert"], "node", ["parentId"], "子 node の追加"),
  mapped("browser.add-sibling", "ブラウザ保存", "viewer.ts addSibling", ["assert"], "node", ["parentId"], "兄弟 node の追加"),
  mapped("browser.rename", "ブラウザ保存", "viewer.ts stopInlineEdit", ["rename"], "node", ["text"], "node の text の確定"),
  mapped("browser.reparent", "ブラウザ保存", "viewer.ts applyReparent", ["reparent"], "node", ["parentId"], "親の変更"),
  mapped("browser.reorder", "ブラウザ保存", "viewer.ts proposeReorderDrop", ["reorder"], "node", ["index"], "同じ親の下の兄弟順"),
  mapped("browser.cut-paste", "ブラウザ保存", "viewer.ts applyMoveByParentAndIndex", ["reparent"], "node", ["parentId"], "cut した部分木を別の親へ置く"),
  mapped(
    "browser.grab",
    "ブラウザ保存",
    "viewer.ts finishGrab",
    ["reparent", "reorder"],
    "node",
    [],
    "Grab の確定。親が変わるなら reparent、兄弟順だけなら reorder",
    "relation",
  ),
  mapped("browser.delete", "ブラウザ保存", "viewer.ts deleteSelected", ["delete"], "node", [], "部分木の削除"),
  mapped("browser.delete-broken-alias", "ブラウザ保存", "viewer.ts deleteBrokenAlias", ["delete"], "node", [], "broken alias の削除"),
  mapped("browser.repair-broken-alias", "ブラウザ保存", "viewer.ts repairBrokenAlias", ["set-type"], "node", ["nodeType"], "broken alias を text node に戻す"),
  mapped("browser.scopen", "ブラウザ保存", "viewer.ts makeSelectedFolder", ["scopen"], "node", [], "scope 境界を付ける"),
  mapped("browser.unscopen", "ブラウザ保存", "viewer.ts makeSelectedFolder", ["unscopen"], "node", [], "scope 境界を外す"),
  mapped("browser.alias-in-scope", "ブラウザ保存", "viewer.ts addAliasInCurrentScope", ["bind"], "node", ["targetNodeId", "parentId"], "scope root の下に alias を作る"),
  mapped("browser.alias-as-child", "ブラウザ保存", "viewer.ts addAliasAsChild", ["bind"], "node", ["targetNodeId", "parentId"], "target の子として alias を作る"),
  mapped("browser.clone", "ブラウザ保存", "viewer.ts pasteCopiedPayload", ["clone"], "node", ["sourceId", "parentId"], "新しい ID での貼り付け"),
  mapped("browser.set-attribute", "ブラウザ保存", "viewer.ts updateStyleJson", ["set-attribute"], "node", ["key", "value"], "attributes の設定"),
  mapped("browser.unset-attribute", "ブラウザ保存", "viewer.ts updateStyleJson", ["unset-attribute"], "node", ["key"], "attributes の削除"),
  mapped("browser.collapse", "ブラウザ保存", "viewer.ts toggleCollapse", ["view"], "node", [], "collapse は Command_Language の view。Glossary では表示操作"),
  mapped("browser.undo", "ブラウザ保存", "viewer.ts undoLastChange", ["history"], "map", [], "local history を戻す"),
  mapped("browser.redo", "ブラウザ保存", "viewer.ts redoLastChange", ["history"], "map", [], "local history を進める"),
  mapped("browser.export", "ブラウザ保存", "viewer.ts downloadJson", ["export"], "map", [], "JSON の書出し。正本にはならない"),

  mapped(
    "browser.whole-state-post",
    "ブラウザ保存",
    "start_viewer.ts handleApi POST",
    ["assert", "rename", "reparent", "delete"],
    "map",
    [],
    "受信 state と基準 state の差分を Command に分解する。兄弟順は reorder、属性は set-attribute / unset-attribute、同じ GraphLink の端点は retarget",
    undefined,
    "whole-state",
  ),
  mapped("browser.merge", "ブラウザ保存", "start_viewer.ts mergeLocalNodeChanges", ["assert", "rename", "reparent", "delete"], "map", [], "基準からマージ結果への差分を四つの intent に分解する", undefined, "whole-state"),
  mapped("browser.force", "ブラウザ保存", "start_viewer.ts handleApi force", ["assert", "rename", "reparent", "delete"], "map", [], "強制置換も基準と受信の差分に分解する", undefined, "whole-state"),
  mapped("browser.scope-replace", "ブラウザ保存", "rapid_mvp.ts writeScopedState", ["assert", "rename", "reparent", "delete"], "map", [], "部分木の前後を四つの intent に分解する", undefined, "whole-state"),
  mapped("browser.group-selected", "ブラウザ保存", "viewer.ts groupSelected", ["assert", "reparent"], "node", ["parentId", "text", "childIds"], "新しい親の assert と、選択 node の reparent", undefined, "group"),
  mapped("browser.conflict-use-local", "ブラウザ保存", "viewer.ts force 保存", ["assert", "rename", "reparent", "delete"], "map", [], "端末側を採る差分を四つの intent に分解する", undefined, "whole-state"),
  mapped("browser.conflict-use-remote", "ブラウザ保存", "viewer.ts 競合 Panel", ["assert", "rename", "reparent", "delete"], "map", [], "相手側を採る差分を四つの intent に分解する", undefined, "whole-state"),
  mapped("browser.external-reload", "ブラウザ保存", "viewer.ts 外部更新の取込み", ["assert", "rename", "reparent", "delete"], "map", [], "取り込んだ状態との差分を四つの intent に分解する", undefined, "whole-state"),
  mapped("browser.open-file-replace", "ブラウザ保存", "viewer.ts file 取込み", ["assert", "rename", "reparent", "delete"], "map", [], "開いている状態との差分を四つの intent に分解する", undefined, "whole-state"),
  mapped("browser.normalize-on-load", "ブラウザ保存", "viewer.ts 読込み時の正規化", ["assert", "rename", "reparent", "delete"], "map", [], "正規化の前後で四つの intent に入る差分だけ Command にする", undefined, "whole-state"),
  unsupported("browser.derived-sync", "ブラウザ保存", "viewer.ts touchDocument の scope と surface 再計算", "派生記録の再計算であり、利用者の intent がない"),
  mapped("browser.annotation", "ブラウザ保存", "viewer.ts finishPenStroke / eraseAnnotationAtPoint", ["assert", "delete", "rename"], "annotation", [], "追加は assert、消去は delete、text 注釈の文言は rename", "action"),
  mapped("browser.surface-layout", "ブラウザ保存", "viewer.ts surfaces", ["view"], "surface", ["key", "value"], "Layout と Surface View の設定。Topology ではなく view"),
  unsupported("browser.concreteness", "ブラウザ保存", "concreteness_axis.ts", "level ごとの親・順・境界が assert / reparent / view のどれか一つに決まっていない"),

  mapped("mcp.create-node", "MCP", "mcp_service.ts m3e_create kind node", ["assert"], "node", ["parentId"], "子 node の追加。属性があれば set-attribute を続ける"),
  mapped("mcp.create-link", "MCP", "mcp_service.ts m3e_create kind link", ["assert"], "GraphLink", ["sourceNodeId", "targetNodeId"], "GraphLink の追加"),
  mapped("mcp.copy", "MCP", "mcp_service.ts m3e_create kind copy", ["clone"], "node", ["sourceId", "parentId"], "部分木を新しい ID で複製する"),
  mapped("mcp.update-text", "MCP", "mcp_service.ts m3e_update kind content", ["rename"], "node", ["text"], "text の変更"),
  mapped("mcp.update-attribute", "MCP", "mcp_service.ts patchAttributes", ["set-attribute"], "node", ["key", "value"], "attributes の設定"),
  mapped("mcp.move", "MCP", "mcp_service.ts m3e_update kind move", ["reparent"], "node", ["parentId"], "親の変更。map をまたぐ移動は現行コードが拒否する"),
  mapped("mcp.scopen", "MCP", "mcp_service.ts m3e_update kind scopen", ["scopen"], "node", [], "nodeType を folder にする"),
  mapped("mcp.unscopen", "MCP", "mcp_service.ts m3e_update kind unscopen", ["unscopen"], "node", [], "scope 境界を外す"),
  mapped("mcp.delete", "MCP", "mcp_service.ts m3e_delete", ["delete"], "node", [], "部分木の削除"),
  mapped("mcp.delete-link", "MCP", "mcp_service.ts m3e_delete link uri", ["delete"], "GraphLink", [], "GraphLink の削除"),

  mapped("import.structure", "import", "mcp_service.ts import_structure", ["assert", "scopen", "set-attribute"], "node", ["parentId", "key", "value"], "木の追加、root の scopen、import key の属性"),
  mapped("import.mfh", "import", "mcp_service.ts import_mfh", ["assert"], "node", ["parentId"], "MF-H を部分木として追加する。同名合流はしない"),
  mapped("import.flash-approve", "import", "flash_ingest.ts approveDraft", ["assert"], "node", ["parentId"], "draft の node を足す"),
  mapped("import.flash-job", "import", "flash_jobs.ts から mcp import_structure", ["assert", "scopen", "set-attribute"], "node", ["parentId", "key", "value"], "生成結果は import.structure と同じ Command 列になる"),
  mapped("import.cas-pn-generate", "import", "start_viewer.ts cas-pn-generate", ["assert", "set-attribute"], "node", ["parentId", "key", "value"], "生成した子と provenance 属性"),
  mapped("import.blueprint", "import", "blueprint_importer.ts importBlueprintToSqlite", ["assert", "rename", "reparent", "delete"], "map", [], "生成した状態との差分を四つの intent に分解する", undefined, "whole-state"),
  mapped("import.append-mf-h", "import", "start_viewer.ts append-mf-h", ["assert", "rename", "reparent", "delete"], "map", [], "合流後の木の差分だけを四つの intent にする。同名再利用は Command を増やさない", undefined, "whole-state"),
  mapped("import.mapify-oracle", "import", "start_viewer.ts rapid-mapify-oracle", ["assert", "rename", "reparent", "delete"], "map", [], "append-mf-h と同じ差分分解", undefined, "whole-state"),

  mapped("linear-text.put", "linear-text", "start_viewer.ts handleLinearNoteApi PUT", ["set-attribute"], "node", ["value"], "scope の linear-text を許可 field として書く"),
  mapped("linear-text.delete", "linear-text", "start_viewer.ts handleLinearNoteApi DELETE", ["unset-attribute"], "node", [], "scope の linear-text を許可 field から外す"),
  mapped("linear-text.edit", "linear-text", "viewer.ts linearNotesByScope", ["set-attribute"], "node", ["value"], "入力の確定を linear-text の set-attribute にする"),
  mapped("linear-text.apply", "linear-text", "viewer.ts applyLinearTextToScope / reconcileLinearSubtree", ["assert", "rename", "delete"], "node", [], "位置で対応する子は rename、足りない位置は assert、余った部分木は delete", undefined, "linear-apply"),

  mapped("graphlink.add", "GraphLink", "viewer.ts createGraphLinkBetween", ["assert"], "GraphLink", ["sourceNodeId", "targetNodeId"], "GraphLink の追加"),
  mapped("graphlink.delete", "GraphLink", "viewer.ts deleteSelectedGraphLink", ["delete"], "GraphLink", [], "GraphLink の削除"),
  mapped("graphlink.set-attribute", "GraphLink", "edge_graphlink_selection_adapter.ts label style direction", ["set-attribute"], "GraphLink", ["key", "value"], "label・style・向きの設定"),
  mapped("graphlink.unset-attribute", "GraphLink", "edge_graphlink_selection_adapter.ts label の削除", ["unset-attribute"], "GraphLink", ["key"], "label などの削除"),
  mapped("graphlink.rest-create", "GraphLink", "start_viewer.ts POST /links", ["assert"], "GraphLink", ["sourceNodeId", "targetNodeId"], "REST の GraphLink 追加"),
  mapped("graphlink.rest-delete", "GraphLink", "start_viewer.ts DELETE /links/:link", ["delete"], "GraphLink", [], "REST の GraphLink 削除"),

  mapped("vault.export", "Vault", "vault_exporter.ts exportVaultFromSqlite", ["export"], "map", [], "Markdown への書出し。SQLite は変えない"),
  mapped("vault.import", "Vault", "vault_importer.ts importVaultToSqlite", ["assert", "rename", "reparent", "delete"], "map", [], "取り込み後の状態との差分を四つの intent に分解する", undefined, "whole-state"),
  mapped("vault.watch-reimport", "Vault", "vault_watch.ts startVaultWatch", ["assert", "rename", "reparent", "delete"], "map", [], "再取り込みの差分を四つの intent に分解する", undefined, "whole-state"),
  unsupported("vault.file-missing", "Vault", "vault_watch.ts vault:status missing", "ファイル削除に伴う属性と alias 参照先の書換えに、一つの定義済み intent がない"),
  unsupported("vault.write-through", "Vault", "vault_watch.ts writeMapToVaultNow", "live では Markdown を canonical source にする。export は正本にならない成果物なので当たらない"),

  mapped("collab.push", "collab", "collab.ts mergeScopePush", ["assert", "rename", "reparent", "delete"], "map", [], "全量送信の前後を四つの intent に分解する。送られなかった node は delete", undefined, "whole-state"),

  mapped("cloud.push", "cloud", "cloud_sync.ts pushWithConflictBackup", ["export"], "map", [], "cloud への複製の送信。正本の移動ではない"),
  mapped("cloud.auto-sync", "cloud", "cloud_sync.ts startAutoSync", ["export"], "map", [], "定期的な cloud への複製の送信"),
  unsupported("cloud.pull", "cloud", "start_viewer.ts cloud pull", "cloud の複製の取り込みであり、Command の書きではない"),

  mapped("backup.restore", "backup restore", "start_viewer.ts parseBackupRoute restore", ["assert", "rename", "reparent", "delete"], "map", [], "backup の状態との差分を四つの intent に分解する。history にはしない", undefined, "whole-state"),

  mapped("home.new", "Home", "home.ts createBlank / rapid_mvp.ts createMap", ["load"], "map", ["label"], "空の map を作る。Command_Language の load は m3e.new を含む"),
  mapped("home.rename", "Home", "home.ts renameMap / rapid_mvp.ts renameMap", ["rename"], "node", ["text"], "root の text を変える"),
  unsupported("home.duplicate", "Home", "rapid_mvp.ts duplicateMap", "map 行の複製に定義済み intent がない。clone は node と部分木の複製"),
  unsupported("home.archive", "Home", "rapid_mvp.ts setArchived", "map 行の archived 列に定義済み intent がない"),
  unsupported("home.restore", "Home", "rapid_mvp.ts setArchived 解除", "archive の解除に定義済み intent がない"),
  unsupported("home.tags", "Home", "rapid_mvp.ts setMapTags", "map 行の tags 列に定義済み intent がない"),
  unsupported("home.pin", "Home", "rapid_mvp.ts setPinned", "map 行の pinned 列に定義済み intent がない"),
  unsupported("home.bind-vault", "Home", "home.ts bindVault", "canonical owner の宣言は、node の移動である transfer に当たらない"),
  unsupported("home.unbind-vault", "Home", "home.ts unbindVault", "canonical owner の解除は transfer に当たらない"),
  mapped("home.import-file", "Home", "home.ts importFromFile", ["assert", "rename", "reparent", "delete"], "map", [], "空の基準から file の状態への差分を四つの intent に分解する", undefined, "whole-state"),
  mapped("home.import-vault", "Home", "home.ts importFromVault", ["assert", "rename", "reparent", "delete"], "map", [], "空の基準から Vault 由来の状態への差分を四つの intent に分解する", undefined, "whole-state"),
  unsupported("home.delete", "Home", "rapid_mvp.ts deleteMap", "map 行の削除に定義済み intent がない。delete は node・Connection・attribute であり root 削除は不可"),

  mapped("startup.ensure-create", "起動時", "start_viewer.ts ensureMap の createMap", ["load"], "map", ["label"], "map が無いときの作成だけ。既存 map では何も書かない"),
  unsupported("startup.legacy-id-migration", "起動時", "start_viewer.ts ensureMap の renameMapId", "旧 map id の付け替えと、そのときの label 上書きは一度きりの移行であり Command ではない"),
  unsupported("startup.schema-migration", "起動時", "rapid_mvp.ts documents から maps への DDL", "schema の移行は Command ではない"),
  unsupported("startup.engine-backup", "起動時", "backup.ts createBackup", "DB file の物理複製であり、export でも journal でもない"),
];

export function mappedWritePaths(): readonly MappedWritePath[] {
  return WRITE_PATHS.filter((path): path is MappedWritePath => path.disposition === "対応");
}

export function unsupportedWritePaths(): readonly UnsupportedWritePath[] {
  return WRITE_PATHS.filter((path): path is UnsupportedWritePath => path.disposition === "未対応");
}

export function findWritePath(id: string): WritePath | undefined {
  return WRITE_PATHS.find((path) => path.id === id);
}

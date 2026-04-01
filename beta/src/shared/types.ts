export type NodeType = "text" | "image" | "folder" | "alias";
export type AliasAccess = "read" | "write";

export interface TreeNode {
  id: string;
  parentId: string | null;
  children: string[];
  nodeType?: NodeType;
  scopeId?: string;
  text: string;
  details: string;
  note: string;
  attributes: Record<string, string>;
  link: string;
  targetNodeId?: string;
  aliasLabel?: string;
  access?: AliasAccess;
  targetSnapshotLabel?: string;
  isBroken?: boolean;
}

export interface AppState {
  rootId: string;
  nodes: Record<string, TreeNode>;
}

export interface SavedDoc {
  version: 1;
  savedAt: string;
  state: AppState;
}

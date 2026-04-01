export interface TreeNode {
  id: string;
  parentId: string | null;
  children: string[];
  text: string;
  collapsed: boolean;
  details: string;
  note: string;
  attributes: Record<string, string>;
  link: string;
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

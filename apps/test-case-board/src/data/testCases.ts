export type TestStatus = 'todo' | 'doing' | 'done' | 'skip';
export type Priority = 'high' | 'medium' | 'low';

export interface TestCase {
  id: string;
  title: string;
  priority: Priority;
  tags: string[];
  attr?: string;
  issue: number;
  status: TestStatus;
  runnable?: boolean;
}

export const statusLabels: Record<TestStatus, string> = {
  todo: '未着手',
  doing: '進行中',
  done: '完了',
  skip: '対象外',
};

export const statusOrder: TestStatus[] = ['todo', 'doing', 'done', 'skip'];

export const testCases: TestCase[] = [
  {
    id: 'TC-001',
    title: 'ネストしたマッピングを正しくパースする',
    priority: 'high',
    tags: ['yaml parser'],
    issue: 101,
    status: 'done',
    runnable: true,
  },
  {
    id: 'TC-003',
    title: 'インラインのフロー配列 [a, b] をパースする',
    priority: 'medium',
    tags: ['yaml parser'],
    issue: 101,
    status: 'done',
  },
  {
    id: 'TC-010',
    title: "複数行 import { ... } from '...' を解決する",
    priority: 'high',
    tags: ['impact'],
    attr: 'import_style=static_multiline',
    issue: 102,
    status: 'done',
  },
  {
    id: 'TC-020',
    title: 'once --json がステータス別カウントを出す',
    priority: 'high',
    tags: ['board cli'],
    issue: 103,
    status: 'done',
  },
  {
    id: 'TC-022',
    title: 'issues:[] と legacy issue: を統合し issueIndex を作る',
    priority: 'high',
    tags: ['issue link'],
    issue: 104,
    status: 'done',
  },
  {
    id: 'TC-002',
    title: 'マッピングのブロックリストをパースする',
    priority: 'high',
    tags: ['yaml parser'],
    issue: 101,
    status: 'doing',
  },
  {
    id: 'TC-011',
    title: '逆方向の推移閉包で間接依存も影響に含める',
    priority: 'high',
    tags: ['impact'],
    issue: 102,
    status: 'doing',
  },
  {
    id: 'TC-007',
    title: 'ブロックスカラー | / > は明示的に拒否する',
    priority: 'low',
    tags: ['yaml parser'],
    issue: 101,
    status: 'skip',
  },
  {
    id: 'TC-004',
    title: 'コロンや -- を含むクォート文字列を保持する',
    priority: 'high',
    tags: ['yaml parser'],
    issue: 101,
    status: 'todo',
  },
  {
    id: 'TC-005',
    title: 'コメントを除去するがクォート内の # は残す',
    priority: 'medium',
    tags: ['yaml parser'],
    issue: 101,
    status: 'todo',
  },
  {
    id: 'TC-006',
    title: '奇数インデントは例外を投げる',
    priority: 'low',
    tags: ['yaml parser'],
    issue: 101,
    status: 'todo',
  },
  {
    id: 'TC-012',
    title: 'require() と動的 import() を検出する',
    priority: 'medium',
    tags: ['impact'],
    attr: 'import_style=require',
    issue: 102,
    status: 'todo',
  },
  {
    id: 'TC-013',
    title: 'bare / node_modules import は無視する',
    priority: 'medium',
    tags: ['impact'],
    issue: 102,
    status: 'todo',
  },
  {
    id: 'TC-008',
    title: 'アンカー & とエイリアス * を解決する',
    priority: 'medium',
    tags: ['yaml parser'],
    issue: 101,
    status: 'todo',
  },
  {
    id: 'TC-009',
    title: '複数ドキュメント --- 区切りを分割する',
    priority: 'low',
    tags: ['yaml parser'],
    issue: 101,
    status: 'todo',
  },
  {
    id: 'TC-014',
    title: '循環依存を検出して警告する',
    priority: 'high',
    tags: ['impact'],
    issue: 102,
    status: 'todo',
  },
  {
    id: 'TC-015',
    title: "re-export export { x } from '...' を辿る",
    priority: 'medium',
    tags: ['impact'],
    attr: 'import_style=reexport',
    issue: 102,
    status: 'todo',
  },
  {
    id: 'TC-016',
    title: 'type-only import を依存から除外する',
    priority: 'low',
    tags: ['impact'],
    attr: 'import_style=type_only',
    issue: 102,
    status: 'todo',
  },
  {
    id: 'TC-017',
    title: 'tsconfig paths エイリアスを解決する',
    priority: 'medium',
    tags: ['impact'],
    issue: 102,
    status: 'todo',
  },
  {
    id: 'TC-018',
    title: '影響集合をトポロジカル順に並べる',
    priority: 'medium',
    tags: ['impact'],
    issue: 102,
    status: 'todo',
  },
  {
    id: 'TC-019',
    title: '未解決 import を診断として報告する',
    priority: 'low',
    tags: ['impact'],
    issue: 102,
    status: 'todo',
  },
  {
    id: 'TC-021',
    title: 'once --watch が差分のみ再計算する',
    priority: 'medium',
    tags: ['board cli'],
    issue: 103,
    status: 'todo',
  },
  {
    id: 'TC-023',
    title: 'issueIndex から逆引き backlinks を生成する',
    priority: 'medium',
    tags: ['issue link'],
    issue: 104,
    status: 'todo',
  },
  {
    id: 'TC-024',
    title: '壊れた issue 参照を検出する',
    priority: 'low',
    tags: ['issue link'],
    issue: 104,
    status: 'todo',
  },
  {
    id: 'TC-025',
    title: 'board と issue のステータスを同期する',
    priority: 'high',
    tags: ['board cli'],
    issue: 103,
    status: 'todo',
  },
];

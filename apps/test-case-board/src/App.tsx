import { useEffect, useMemo, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  statusLabels,
  statusOrder,
  TestCase,
  TestStatus,
  testCases,
} from './data/testCases';

type BoardState = Record<TestStatus, string[]>;
type TopTab = 'worktree' | 'tests';
type ViewMode = 'graph' | 'board' | 'table' | 'analysis' | 'worktree';

const STORAGE_KEY = 'test-case-board:v1';

const viewLabels: Record<ViewMode, string> = {
  graph: 'グラフ',
  board: 'ボード',
  table: 'テーブル',
  analysis: '分析',
  worktree: 'Worktree',
};

const seedBoard = (): BoardState => {
  const next: BoardState = { todo: [], doing: [], done: [], skip: [] };
  for (const testCase of testCases) {
    next[testCase.status].push(testCase.id);
  }
  return next;
};

const loadBoard = (): BoardState => {
  if (typeof window === 'undefined') {
    return seedBoard();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return seedBoard();
    }

    const parsed = JSON.parse(raw) as Partial<BoardState>;
    const validIds = new Set(testCases.map((testCase) => testCase.id));
    const seen = new Set<string>();
    const next: BoardState = { todo: [], doing: [], done: [], skip: [] };

    for (const status of statusOrder) {
      for (const id of parsed[status] ?? []) {
        if (validIds.has(id) && !seen.has(id)) {
          next[status].push(id);
          seen.add(id);
        }
      }
    }

    for (const testCase of testCases) {
      if (!seen.has(testCase.id)) {
        next[testCase.status].push(testCase.id);
      }
    }

    return next;
  } catch {
    return seedBoard();
  }
};

const findContainer = (
  board: BoardState,
  id: UniqueIdentifier | null | undefined,
): TestStatus | null => {
  if (!id) {
    return null;
  }

  const key = String(id);
  if (statusOrder.includes(key as TestStatus)) {
    return key as TestStatus;
  }

  return statusOrder.find((status) => board[status].includes(key)) ?? null;
};

const moveCard = (
  board: BoardState,
  cardId: string,
  toStatus: TestStatus,
): BoardState => {
  const fromStatus = findContainer(board, cardId);
  if (!fromStatus || fromStatus === toStatus) {
    return board;
  }

  return {
    ...board,
    [fromStatus]: board[fromStatus].filter((id) => id !== cardId),
    [toStatus]: [...board[toStatus], cardId],
  };
};

export function App() {
  const [topTab, setTopTab] = useState<TopTab>('tests');
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [board, setBoard] = useState<BoardState>(loadBoard);
  const [activeId, setActiveId] = useState<string | null>(null);

  const testCaseById = useMemo(
    () => new Map(testCases.map((testCase) => [testCase.id, testCase])),
    [],
  );

  const counts = useMemo(
    () => ({
      total: testCases.length,
      todo: board.todo.length,
      doing: board.doing.length,
      done: board.done.length,
      skip: board.skip.length,
    }),
    [board],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
  }, [board]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const activeCardId = String(active.id);
    const overCardId = over ? String(over.id) : null;
    const activeContainer = findContainer(board, active.id);
    const overContainer = findContainer(board, over?.id);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setBoard((current) => {
      const currentActive = findContainer(current, active.id);
      const currentOver = findContainer(current, over?.id);

      if (!currentActive || !currentOver || currentActive === currentOver) {
        return current;
      }

      const activeItems = current[currentActive];
      const overItems = current[currentOver];
      const activeIndex = activeItems.indexOf(activeCardId);
      const overIndex = overCardId ? overItems.indexOf(overCardId) : -1;
      const insertAt = overIndex >= 0 ? overIndex : overItems.length;

      return {
        ...current,
        [currentActive]: activeItems.filter((id) => id !== activeCardId),
        [currentOver]: [
          ...overItems.slice(0, insertAt),
          activeCardId,
          ...overItems.slice(insertAt),
        ],
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      return;
    }

    setBoard((current) => {
      const activeContainer = findContainer(current, active.id);
      const overContainer = findContainer(current, over.id);

      if (!activeContainer || !overContainer) {
        return current;
      }

      if (activeContainer !== overContainer) {
        return current;
      }

      const activeIndex = current[activeContainer].indexOf(String(active.id));
      const overIndex = current[overContainer].indexOf(String(over.id));

      if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
        return current;
      }

      return {
        ...current,
        [activeContainer]: arrayMove(current[activeContainer], activeIndex, overIndex),
      };
    });
  };

  const handleStatusChange = (cardId: string, status: TestStatus) => {
    setBoard((current) => moveCard(current, cardId, status));
  };

  const activeCard = activeId ? testCaseById.get(activeId) : null;
  const shouldShowBoard = topTab === 'tests' && viewMode === 'board';

  return (
    <main className="app-shell">
      <nav className="top-tabs" aria-label="primary">
        <div className="tab-set">
          <button
            className={topTab === 'worktree' ? 'top-tab active' : 'top-tab'}
            onClick={() => setTopTab('worktree')}
            type="button"
          >
            Worktree
          </button>
          <button
            className={topTab === 'tests' ? 'top-tab active' : 'top-tab'}
            onClick={() => setTopTab('tests')}
            type="button"
          >
            テストケース
          </button>
        </div>
        <a className="external-link" href="/" onClick={(event) => event.preventDefault()}>
          ↗ 別タブ
        </a>
      </nav>

      <section className="toolbar" aria-label="board toolbar">
        <div className="identity">
          <span className="status-dot" aria-hidden="true" />
          <strong>test-case-board</strong>
          <span className="self-label">(self)</span>
          <span className="runner-pill">node --test</span>
        </div>

        <div className="view-toggle" role="tablist" aria-label="views">
          {Object.entries(viewLabels).map(([key, label]) => {
            const mode = key as ViewMode;
            return (
              <button
                key={mode}
                className={viewMode === mode ? 'view-button active' : 'view-button'}
                onClick={() => setViewMode(mode)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="stats" aria-label="test counts">
          <StatPill label="total" value={counts.total} />
          <StatPill label="todo" value={counts.todo} />
          <StatPill label="doing" value={counts.doing} />
          <StatPill label="done" value={counts.done} />
          <StatPill label="skip" value={counts.skip} />
        </div>
      </section>

      {shouldShowBoard ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <section className="board" aria-label="test case board">
            {statusOrder.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                cardIds={board[status]}
                testCaseById={testCaseById}
                onStatusChange={handleStatusChange}
              />
            ))}
          </section>
          <div className="drag-sr" aria-live="polite">
            {activeCard ? `${activeCard.id} を移動中` : ''}
          </div>
        </DndContext>
      ) : (
        <section className="placeholder">
          <p>（このビューは未実装です）</p>
          <span>Coming soon</span>
        </section>
      )}
    </main>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="stat-pill">
      {label}: <strong>{value}</strong>
    </span>
  );
}

function BoardColumn({
  status,
  cardIds,
  testCaseById,
  onStatusChange,
}: {
  status: TestStatus;
  cardIds: string[];
  testCaseById: Map<string, TestCase>;
  onStatusChange: (cardId: string, status: TestStatus) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <section className="column">
      <header className="column-header">
        <span className={`status-pill ${status}`}>{statusLabels[status]}</span>
        <span className="column-count">{cardIds.length}</span>
      </header>

      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        <div className="card-list" ref={setNodeRef}>
          {cardIds.map((id) => {
            const testCase = testCaseById.get(id);
            if (!testCase) {
              return null;
            }

            return (
              <TestCaseCard
                key={id}
                testCase={{ ...testCase, status }}
                onStatusChange={onStatusChange}
              />
            );
          })}
        </div>
      </SortableContext>
    </section>
  );
}

function TestCaseCard({
  testCase,
  onStatusChange,
}: {
  testCase: TestCase;
  onStatusChange: (cardId: string, status: TestStatus) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: testCase.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      className={isDragging ? 'test-card dragging' : 'test-card'}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div className="card-topline">
        <span className="case-id">{testCase.id}</span>
        <label className="status-select-wrap" onPointerDown={(event) => event.stopPropagation()}>
          <select
            aria-label={`${testCase.id} status`}
            className={`status-select ${testCase.status}`}
            value={testCase.status}
            onChange={(event) =>
              onStatusChange(testCase.id, event.target.value as TestStatus)
            }
          >
            {statusOrder.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h2 className="card-title">{testCase.title}</h2>

      <div className="card-meta">
        <span className={`priority ${testCase.priority}`}>{testCase.priority}</span>
        {testCase.tags.map((tag) => (
          <span className="tag-pill" key={tag}>
            {tag}
          </span>
        ))}
        {testCase.attr ? <span className="attr-pill">{testCase.attr}</span> : null}
        {testCase.runnable ? (
          <button
            className="run-button"
            aria-label={`${testCase.id} run`}
            onPointerDown={(event) => event.stopPropagation()}
            type="button"
          >
            ▶
          </button>
        ) : null}
        <span className="issue-pill">#{testCase.issue}</span>
      </div>
    </article>
  );
}

/**
 * Undo / Redo の現行保持場所（beta、読み取りのみ）:
 *
 * - `src/node/rapid_mvp.ts` の `RapidMvpModel.undoStack` / `redoStack` は
 *   `AppState[]`。`_pushHistory` は `_cloneState()`（`JSON.parse(JSON.stringify(this.state))`）
 *   で map 全状態を複製して undo 側へ積み、redo 側を空にする。上限 200。
 *   `undo` / `redo` は現在の全状態を反対側へ複製し、積んである全状態へ `this.state` を差し替える。
 *   `fromJSON` は両スタックを空にする。操作の id も before / after も残らない。
 * - `src/node/mcp_service.ts` の import 経路は、同じモデルの `_pushHistory()` を呼ぶ。別ストアではない。
 * - `src/browser/viewer.ts` の `undoStack` / `redoStack` は `UndoSnapshot[]`。
 *   各要素は `cloneState(canonicalMapState())` による `AppState` 全状態の複製に、
 *   concreteness・scope・collapsed・選択を同梱する。上限 200。変更が無かった template 適用は
 *   積んだ直後に `pop` する。grab は開始時の snapshot を `grabSession.before` に持ち、
 *   移動後に undo 側へ載せる。map の読み込みで両スタックは空になる。
 * - SQLite `maps.state_json` は現在の map 全状態を 1 行に持つ。操作列ではない。
 *
 * いずれも全状態の複製であり、Command の因果列ではない。
 *
 * journal（用語集）: Command / operation の因果と履歴を replay 可能に保存する論理記録。
 * 操作の歴史であり、database engine の物理複製である backup ではない。
 * ここでの 1 レコードは 1 Command で、`operationId` がその同一性、`before` が変更前、
 * `after` が変更後。cursor より前を順に適用すると現在の subject を replay できる。
 *
 * 物理形式の配置案（このモジュールはメモリ上の論理記録だけを持つ。ファイルも DB も書かない）:
 * map ごとに JSONL 1 本を portable snapshot の隣へ置く（`journal/<mapId>.jsonl`、
 * 1 行が 1 Command の operationId / before / after）。
 * `maps.state_json` と Neo4j のデータファイルへは書かない。圧縮するときは、覆った範囲の
 * portable snapshot を新たに書き、その範囲の journal 前置を捨てる。
 *
 * この境界へ移せない履歴:
 * - 既に積んである全状態の複製。operationId が無いので、操作列へ分解できない。
 * - viewer の選択、collapsed、concreteness、scope、grab 前 snapshot。表示状態であり AppState の操作ではない。
 * - URL の `history.replaceState` と、SSE の event cursor。編集の Undo ではない。
 */

export interface CausalOperation<T> {
  /** 一つの Command の同一性。同じ id の再送は二件目として追記しない。 */
  operationId: string;
  /** この操作の直前の subject。 */
  before: T;
  /** この操作の直後の subject。 */
  after: T;
}

export interface OperationJournal<T> {
  /** 操作が一つも無いときの subject。 */
  initial: T;
  /** 古い操作が先頭の因果列。cursor より後ろは、まだ redo できる尾。 */
  operations: readonly CausalOperation<T>[];
  /** 最後に適用した操作の添字。-1 は initial。 */
  cursor: number;
}

export function createOperationJournal<T>(initial: T): OperationJournal<T> {
  return seal({
    initial: freezeData(initial),
    operations: Object.freeze([]),
    cursor: -1,
  });
}

/** 因果列の末尾へ 1 操作を追記する。入力の journal は変えない。 */
export function appendOperation<T>(journal: OperationJournal<T>, operation: CausalOperation<T>): OperationJournal<T> {
  const operationId = requireOperationId(operation.operationId);
  const existing = journal.operations.find((recorded) => recorded.operationId === operationId);
  if (existing) {
    if (sameOperation(existing, operation)) {
      return journal;
    }
    throw new Error(`operation ${operationId} is already in the journal with different before/after`);
  }
  if (!deepEqual(operation.before, subject(journal))) {
    throw new Error(`operation ${operationId} before does not match the current subject`);
  }

  const retained = journal.operations.slice(0, journal.cursor + 1);
  const recorded: CausalOperation<T> = Object.freeze({
    operationId,
    before: freezeData(operation.before),
    after: freezeData(operation.after),
  });
  return seal({
    initial: journal.initial,
    operations: Object.freeze([...retained, recorded]),
    cursor: retained.length,
  });
}

/** 因果列を一段戻す。適用済みの操作が無ければ同じ journal を返す。 */
export function undo<T>(journal: OperationJournal<T>): OperationJournal<T> {
  if (journal.cursor < 0) {
    return journal;
  }
  return seal({
    initial: journal.initial,
    operations: journal.operations,
    cursor: journal.cursor - 1,
  });
}

/** undo で外した直後の操作を、再度適用する。尾が無ければ同じ journal を返す。 */
export function redo<T>(journal: OperationJournal<T>): OperationJournal<T> {
  if (journal.cursor >= journal.operations.length - 1) {
    return journal;
  }
  return seal({
    initial: journal.initial,
    operations: journal.operations,
    cursor: journal.cursor + 1,
  });
}

/** cursor 地点の subject。返り値は journal 内の値とは別の複製。 */
export function subject<T>(journal: OperationJournal<T>): T {
  if (journal.cursor < 0) {
    return clone(journal.initial);
  }
  const operation = journal.operations[journal.cursor];
  if (!operation) {
    throw new Error("journal cursor is outside the operation sequence");
  }
  return clone(operation.after);
}

function requireOperationId(operationId: string): string {
  if (typeof operationId !== "string" || operationId.length === 0) {
    throw new Error("operationId is required");
  }
  return operationId;
}

function sameOperation<T>(recorded: CausalOperation<T>, operation: CausalOperation<T>): boolean {
  return deepEqual(recorded.before, operation.before) && deepEqual(recorded.after, operation.after);
}

function seal<T>(journal: OperationJournal<T>): OperationJournal<T> {
  return Object.freeze(journal);
}

function freezeData<T>(value: T): T {
  return deepFreeze(clone(value));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((item, index) => deepEqual(item, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key) && deepEqual(leftRecord[key], rightRecord[key]));
}

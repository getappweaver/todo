import type { Database } from 'bun:sqlite';

import type { CreateTodoDraft } from '../types/drafts';
import type {
  CreateTodoInput,
  Todo,
  TodoWithWinStats,
  UpdateTodoInput,
} from '../types/todos';

import { rowToTodo } from './todo-row';

type TodoWithWin = Todo & {
  wins: number;
  losses: number;
  win_rate: number | null;
};

const TODO_SETTINGS_FOCUS_KEY = 'focus_id';

function compareSortOrder(a: Todo, b: Todo): number {
  const ao = a.sort_order;
  const bo = b.sort_order;

  if (ao === null && bo === null) {
    return a.created_at - b.created_at;
  }

  if (ao === null) {
    return -1;
  }

  if (bo === null) {
    return 1;
  }

  if (ao !== bo) {
    return ao - bo;
  }

  return a.created_at - b.created_at;
}

function compareSiblings(a: TodoWithWin, b: TodoWithWin): number {
  if (a.win_rate === null && b.win_rate === null) {
    return compareSortOrder(a, b);
  }

  if (a.win_rate === null) {
    return 1;
  }

  if (b.win_rate === null) {
    return -1;
  }

  if (b.win_rate !== a.win_rate) {
    return b.win_rate - a.win_rate;
  }

  return compareSortOrder(a, b);
}

function listTodosDepthFirstWinOrdered(db: Database): TodoWithWinStats[] {
  const rows = db
    .prepare(
      `SELECT
        t.id,
        t.parent_id,
        t.todo,
        t.status,
        t.sort_order,
        t.description,
        t.tags,
        t.source,
        t.created_at,
        t.updated_at,
        t.completed_at,
        (SELECT COUNT(*) FROM todo_comparisons w WHERE w.winner_id = t.id) AS wins,
        (SELECT COUNT(*) FROM todo_comparisons l WHERE l.loser_id = t.id) AS losses
      FROM todos t`,
    )
    .all() as Record<string, unknown>[];

  const withWin: TodoWithWin[] = rows.map((row) => {
    const base = rowToTodo(row);
    const wins = Number(row.wins ?? 0);
    const losses = Number(row.losses ?? 0);
    const total = wins + losses;
    const win_rate = total === 0 ? null : wins / total;

    return {
      ...base,
      wins,
      losses,
      win_rate,
    };
  });

  const byParent = new Map<number | null, TodoWithWin[]>();

  for (const todo of withWin) {
    const key = todo.parent_id ?? null;

    if (!byParent.has(key)) {
      byParent.set(key, []);
    }

    byParent.get(key)!.push(todo);
  }

  for (const items of byParent.values()) {
    items.sort(compareSiblings);
  }

  const out: TodoWithWinStats[] = [];

  function walk(parentId: number | null): void {
    const children = byParent.get(parentId) ?? [];

    for (const todo of children) {
      out.push(todo);
      walk(todo.id);
    }
  }

  walk(null);

  return out;
}

export function getTodo(db: Database, id: number): Todo | null {
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;

  return row ? rowToTodo(row) : null;
}

export function getTodoPathFromScopeToLeaf(
  db: Database,
  leafId: number,
  scopeParentId: number | null,
): Todo[] {
  const up: Todo[] = [];
  let current: number | null = leafId;

  while (current !== null) {
    const todo = getTodo(db, current);

    if (!todo) {
      break;
    }

    up.push(todo);

    if (todo.parent_id === scopeParentId) {
      break;
    }

    current = todo.parent_id;
  }

  up.reverse();

  if (scopeParentId !== null) {
    const scopeNode = getTodo(db, scopeParentId);

    if (scopeNode) {
      return [scopeNode, ...up];
    }
  }

  return up;
}

export function createTodo(
  db: Database,
  input: CreateTodoInput,
  source?: string,
): Todo {
  const now = Date.now();

  const info = db
    .query(
      `INSERT INTO todos (parent_id, todo, status, description, tags, source, created_at)
     VALUES ($parentId, $todo, 'pending', $description, $tags, $source, $createdAt)`,
    )
    .run({
      parentId: input.parent_id ?? null,
      todo: input.todo,
      description: input.description ?? null,
      tags: input.tags ? JSON.stringify(input.tags) : null,
      source: source ?? null,
      createdAt: now,
    });

  return getTodo(db, Number(info.lastInsertRowid))!;
}

export function createTodosFromDraftTree(
  db: Database,
  draft: CreateTodoDraft,
  source?: string,
): Todo[] {
  const created: Todo[] = [];

  function walk(node: CreateTodoDraft, parentId: number | null): void {
    const todo = createTodo(
      db,
      {
        todo: node.todo,
        parent_id: parentId,
        description: node.description ?? null,
        tags: node.tags ?? null,
      },
      source,
    );

    created.push(todo);

    for (const child of node.children ?? []) {
      walk(child, todo.id);
    }
  }

  walk(draft, draft.parent_id ?? null);

  return created;
}

export function updateTodo(db: Database, input: UpdateTodoInput): Todo | null {
  const existing = getTodo(db, input.id);

  if (!existing) {
    return null;
  }

  const now = Date.now();

  const completedAt =
    input.status === 'done' && existing.status !== 'done'
      ? now
      : existing.completed_at;

  db.query(
    `UPDATE todos SET
      todo         = $todo,
      status       = $status,
      description  = $description,
      tags         = $tags,
      updated_at   = $updatedAt,
      completed_at = $completedAt
     WHERE id = $id`,
  ).run({
    todo: input.todo ?? existing.todo,
    status: input.status ?? existing.status,
    description:
      input.description !== undefined
        ? input.description
        : (existing.description ?? null),
    tags:
      input.tags !== undefined
        ? input.tags
          ? JSON.stringify(input.tags)
          : null
        : existing.tags
          ? JSON.stringify(existing.tags)
          : null,
    updatedAt: now,
    completedAt,
    id: input.id,
  });

  return getTodo(db, input.id);
}

export type MoveTodoResult =
  | { ok: true; todo: Todo; unchanged: boolean }
  | {
      ok: false;
      reason: 'not_found' | 'parent_not_found' | 'self_parent' | 'cycle';
    };

export function moveTodo(
  db: Database,
  id: number,
  newParentId: number | null,
): MoveTodoResult {
  const todo = getTodo(db, id);

  if (!todo) {
    return { ok: false, reason: 'not_found' };
  }

  const currentParent = todo.parent_id ?? null;
  const nextParent = newParentId ?? null;

  if (currentParent === nextParent) {
    return { ok: true, todo, unchanged: true };
  }

  if (newParentId !== null) {
    if (newParentId === id) {
      return { ok: false, reason: 'self_parent' };
    }

    const parent = getTodo(db, newParentId);

    if (!parent) {
      return { ok: false, reason: 'parent_not_found' };
    }

    if (getSubtreeTodoIds(db, id).has(newParentId)) {
      return { ok: false, reason: 'cycle' };
    }
  }

  const now = Date.now();

  const maxSortRow =
    newParentId === null
      ? (db
          .prepare(
            `SELECT COALESCE(MAX(sort_order), -1) AS m FROM todos WHERE parent_id IS NULL AND id != ?`,
          )
          .get(id) as { m: number } | undefined)
      : (db
          .prepare(
            `SELECT COALESCE(MAX(sort_order), -1) AS m FROM todos WHERE parent_id = ? AND id != ?`,
          )
          .get(newParentId, id) as { m: number } | undefined);

  db.query(
    `UPDATE todos SET parent_id = $parentId, sort_order = $sortOrder, updated_at = $updatedAt WHERE id = $id`,
  ).run({
    parentId: newParentId,
    sortOrder: (maxSortRow?.m ?? -1) + 1,
    updatedAt: now,
    id,
  });

  const updated = getTodo(db, id);

  if (!updated) {
    return { ok: false, reason: 'not_found' };
  }

  return { ok: true, todo: updated, unchanged: false };
}

export function doneTodo(db: Database, id: number, cascade = true): boolean {
  if (!getTodo(db, id)) {
    return false;
  }

  const now = Date.now();

  if (cascade) {
    db.query(
      `WITH RECURSIVE descendants(id) AS (
        SELECT id FROM todos WHERE id = $id
        UNION ALL
        SELECT t.id FROM todos t JOIN descendants d ON t.parent_id = d.id
      )
      UPDATE todos SET status = 'done', completed_at = $completedAt, updated_at = $updatedAt
      WHERE id IN (SELECT id FROM descendants)`,
    ).run({
      completedAt: now,
      updatedAt: now,
      id,
    });
  } else {
    db.query(
      `UPDATE todos SET status = 'done', completed_at = $completedAt, updated_at = $updatedAt WHERE id = $id`,
    ).run({
      completedAt: now,
      updatedAt: now,
      id,
    });
  }

  return true;
}

export function deleteTodo(db: Database, id: number): boolean {
  const info = db.prepare('DELETE FROM todos WHERE id = ?').run(id);

  return info.changes > 0;
}

export function getFocusId(db: Database): number | null {
  const row = db
    .prepare(`SELECT value FROM todo_settings WHERE key = ?`)
    .get(TODO_SETTINGS_FOCUS_KEY) as { value: string } | undefined;

  if (!row) {
    return null;
  }

  const parsed = parseInt(String(row.value), 10);

  return Number.isNaN(parsed) ? null : parsed;
}

export function setFocusId(db: Database, id: number): void {
  db.run(
    `INSERT INTO todo_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [TODO_SETTINGS_FOCUS_KEY, String(id)],
  );
}

export function getSubtreeTodoIds(db: Database, rootId: number): Set<number> {
  const rows = db
    .prepare(
      `WITH RECURSIVE sub(id) AS (
        SELECT id FROM todos WHERE id = ?
        UNION ALL
        SELECT t.id FROM todos t JOIN sub ON t.parent_id = sub.id
      )
      SELECT id FROM sub`,
    )
    .all(rootId) as { id: number }[];

  return new Set(rows.map((row) => row.id));
}

export function listTodos(db: Database): TodoWithWinStats[] {
  return listTodosDepthFirstWinOrdered(db);
}

export function listTodosInSubtree(
  db: Database,
  rootId: number,
): TodoWithWinStats[] {
  const ids = getSubtreeTodoIds(db, rootId);

  return listTodos(db).filter((todo) => ids.has(todo.id));
}

// ---------------------------------------------------------------------------
// plugins/todo/db.ts — CRUD operations for the todos table
// ---------------------------------------------------------------------------
import { join } from 'path';

import { Database } from 'bun:sqlite';

import { createTodoDraftsTable } from './drafts';
import { rowToTodo } from './todo-row';
import type {
  Todo,
  CreateTodoDraft,
  CreateTodoInput,
  UpdateTodoInput,
  TodoWithWinStats,
} from './types';

// ---------------------------------------------------------------------------
// Schema migration — called from TodoPlugin.onInit (plugins/todo/init.ts)
// ---------------------------------------------------------------------------

export const TODO_SETTINGS_FOCUS_KEY = 'focus_id';

function migrateTodoSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS todo_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS todo_comparisons (
      winner_id   INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      loser_id    INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      compared_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (winner_id, loser_id)
    )
  `);

  db.run(
    'CREATE INDEX IF NOT EXISTS idx_comparisons_winner ON todo_comparisons(winner_id)',
  );

  db.run(
    'CREATE INDEX IF NOT EXISTS idx_comparisons_loser ON todo_comparisons(loser_id)',
  );

  const cols = db.prepare('PRAGMA table_info(todos)').all() as {
    name: string;
  }[];

  if (cols.some((c) => c.name === 'priority')) {
    db.run('ALTER TABLE todos DROP COLUMN priority');
  }
}

export function createTodoTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id           INTEGER PRIMARY KEY,
      parent_id    INTEGER REFERENCES todos(id) ON DELETE CASCADE,
      todo         TEXT    NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'pending',
      sort_order   INTEGER,
      description  TEXT,
      tags         TEXT,
      source       TEXT,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER,
      completed_at INTEGER
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_todos_parent_id ON todos(parent_id)');

  db.run(
    'CREATE INDEX IF NOT EXISTS idx_todos_parent_sort ON todos(parent_id, sort_order)',
  );

  migrateTodoSchema(db);
}

// ---------------------------------------------------------------------------
// List ordering (win-rate among siblings; unscored last; then sort_order, created_at)
// ---------------------------------------------------------------------------

type TodoWithWin = Todo & {
  wins: number;
  losses: number;
  win_rate: number | null;
};

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

  for (const t of withWin) {
    const key = t.parent_id ?? null;

    if (!byParent.has(key)) {
      byParent.set(key, []);
    }

    byParent.get(key)!.push(t);
  }

  for (const arr of byParent.values()) {
    arr.sort(compareSiblings);
  }

  const out: TodoWithWinStats[] = [];

  function walk(parentId: number | null): void {
    const children = byParent.get(parentId) ?? [];

    for (const t of children) {
      out.push(t);
      walk(t.id);
    }
  }

  walk(null);

  return out;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

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

  const id = Number(info.lastInsertRowid); // bigint in bun:sqlite

  return getTodo(db, id)!;
}

/** Create todos from a draft tree (pre-order: parent then children). Returns all created todos. */
export function createTodosFromDraftTree(
  db: Database,
  draft: CreateTodoDraft,
  source?: string,
): Todo[] {
  const created: Todo[] = [];

  function walk(node: CreateTodoDraft, parentId: number | null): void {
    const input: CreateTodoInput = {
      todo: node.todo,
      parent_id: parentId,
      description: node.description ?? null,
      tags: node.tags ?? null,
    };

    const todo = createTodo(db, input, source);

    created.push(todo);

    const children = node.children ?? [];

    children.forEach((child: CreateTodoDraft) => walk(child, todo.id));
  }

  walk(draft, null);

  return created;
}

export function getTodo(db: Database, id: number): Todo | null {
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;

  return row ? rowToTodo(row) : null;
}

export function listTodos(db: Database): TodoWithWinStats[] {
  return listTodosDepthFirstWinOrdered(db);
}

export function getFocusId(db: Database): number | null {
  const row = db
    .prepare(`SELECT value FROM todo_settings WHERE key = ?`)
    .get(TODO_SETTINGS_FOCUS_KEY) as { value: string } | undefined;

  if (!row) {
    return null;
  }

  const n = parseInt(String(row.value), 10);

  return Number.isNaN(n) ? null : n;
}

export function setFocusId(db: Database, id: number): void {
  db.run(
    `INSERT INTO todo_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [TODO_SETTINGS_FOCUS_KEY, String(id)],
  );
}

export function clearFocusId(db: Database): void {
  db.run(`DELETE FROM todo_settings WHERE key = ?`, [TODO_SETTINGS_FOCUS_KEY]);
}

/** All todo ids in the subtree rooted at `rootId` (includes `rootId`). */
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

  return new Set(rows.map((r) => r.id));
}

export function listTodosInSubtree(
  db: Database,
  rootId: number,
): TodoWithWinStats[] {
  const ids = getSubtreeTodoIds(db, rootId);
  const all = listTodos(db);

  return all.filter((t) => ids.has(t.id));
}

export function listTopLevelTodos(db: Database): Todo[] {
  const rows = db
    .prepare(
      `SELECT * FROM todos WHERE parent_id IS NULL ORDER BY sort_order, created_at`,
    )
    .all() as Record<string, unknown>[];

  return rows.map(rowToTodo);
}

export function listChildTodos(db: Database, parentId: number): Todo[] {
  const rows = db
    .prepare(
      `SELECT * FROM todos WHERE parent_id = ? ORDER BY sort_order, created_at`,
    )
    .all(parentId) as Record<string, unknown>[];

  return rows.map(rowToTodo);
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
    completedAt: completedAt,
    id: input.id,
  });

  return getTodo(db, input.id);
}

export function doneTodo(db: Database, id: number, cascade = true): boolean {
  const todo = getTodo(db, id);

  if (!todo) {
    return false;
  }

  const now = Date.now();

  if (cascade) {
    // Mark all descendants done via recursive CTE
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
      id: id,
    });
  }

  return true;
}

export function deleteTodo(db: Database, id: number): boolean {
  // CASCADE on the FK handles descendants automatically (requires PRAGMA foreign_keys = ON)
  const info = db.prepare('DELETE FROM todos WHERE id = ?').run(id);

  return info.changes > 0;
}

// ---------------------------------------------------------------------------
// DB opener (single source of truth for CLI + plugins)
// ---------------------------------------------------------------------------

export function openDb(): Database {
  const db = new Database(join(import.meta.dir, 'db.sqlite'), { strict: true });
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode=WAL');
  createTodoTable(db);
  createTodoDraftsTable(db);

  return db;
}

export { rowToTodo } from './todo-row';

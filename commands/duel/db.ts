import type { Database, SQLQueryBindings } from 'bun:sqlite';

import { rowToTodo } from '../../db/todo-row';
import { getFocusId } from '../../db/todos';
import type { Todo } from '../../types/todos';

import type { NextPair, RankedTodo } from './representation';

function whereParentIdEquals(
  column: 'parent_id' | 't.parent_id',
  parentId: number | null,
): { clause: string; args: unknown[] } {
  if (parentId === null) {
    return { clause: `${column} IS NULL`, args: [] };
  }

  return { clause: `${column} = ?`, args: [parentId] };
}

export function formatWinRate(todo: {
  win_rate: number | null;
  wins: number;
  losses: number;
}): string {
  if (todo.win_rate === null) {
    return 'unscored';
  }

  const pct = Math.round(todo.win_rate * 100);

  return `${pct}%  ${todo.wins ?? 0}W/${todo.losses ?? 0}L`;
}

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

function compareSiblings(a: RankedTodo, b: RankedTodo): number {
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

export function getParentId(args: string[], db: Database): number | null {
  const raw = args[0]?.trim();

  if (raw) {
    const id = parseInt(raw, 10);

    if (!Number.isNaN(id) && id > 0) {
      return id;
    }
  }

  return getFocusId(db);
}

export function getRankedSiblings(
  db: Database,
  parentId: number | null,
): RankedTodo[] {
  const { clause, args } = whereParentIdEquals('t.parent_id', parentId);

  const stmt = db.prepare(
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
        (
          SELECT COUNT(*)
          FROM todo_comparisons w
          JOIN todos peer ON peer.id = w.loser_id
          WHERE w.winner_id = t.id
            AND peer.parent_id IS t.parent_id
            AND peer.status NOT IN ('done', 'cancelled')
        ) AS wins,
        (
          SELECT COUNT(*)
          FROM todo_comparisons l
          JOIN todos peer ON peer.id = l.winner_id
          WHERE l.loser_id = t.id
            AND peer.parent_id IS t.parent_id
            AND peer.status NOT IN ('done', 'cancelled')
        ) AS losses
      FROM todos t
      WHERE ${clause}
        AND t.status NOT IN ('done', 'cancelled')`,
  );

  const rows = (
    args.length === 0 ? stmt.all() : stmt.all(...(args as SQLQueryBindings[]))
  ) as Record<string, unknown>[];

  const ranked = rows.map((row) => {
    const base = rowToTodo(row);
    const wins = Number(row.wins ?? 0);
    const losses = Number(row.losses ?? 0);
    const total = wins + losses;

    return {
      ...base,
      wins,
      losses,
      win_rate: total === 0 ? null : wins / total,
    };
  });

  ranked.sort(compareSiblings);

  return ranked;
}

export function collectLeavesInDFSOrder(
  db: Database,
  ranked: RankedTodo[],
): RankedTodo[] {
  const out: RankedTodo[] = [];

  for (const todo of ranked) {
    const childRanked = getRankedSiblings(db, todo.id);

    if (childRanked.length === 0) {
      out.push(todo);
    } else {
      out.push(...collectLeavesInDFSOrder(db, childRanked));
    }
  }

  return out;
}

export function firstPendingLeafAfterFirst(
  leaves: RankedTodo[],
): RankedTodo | null {
  for (let index = 1; index < leaves.length; index++) {
    if (leaves[index].status === 'pending') {
      return leaves[index];
    }
  }

  return null;
}

export function getNextPair(
  db: Database,
  parentId: number | null,
): NextPair | null {
  const { clause, args } = whereParentIdEquals('parent_id', parentId);

  const stmt = db.prepare(
    `WITH siblings AS (
        SELECT id, todo FROM todos
        WHERE ${clause} AND status NOT IN ('done', 'cancelled')
      ),
      scored AS (
        SELECT winner_id AS id FROM todo_comparisons
          WHERE winner_id IN (SELECT id FROM siblings)
            AND loser_id IN (SELECT id FROM siblings)
        UNION
        SELECT loser_id AS id FROM todo_comparisons
          WHERE loser_id IN (SELECT id FROM siblings)
            AND winner_id IN (SELECT id FROM siblings)
      )
      SELECT
        s1.id    AS aId,
        s1.todo  AS aTitle,
        s2.id    AS bId,
        s2.todo  AS bTitle
      FROM siblings s1
      JOIN siblings s2 ON s2.id > s1.id
      LEFT JOIN todo_comparisons c
        ON (c.winner_id = s1.id AND c.loser_id = s2.id)
        OR (c.winner_id = s2.id AND c.loser_id = s1.id)
      WHERE c.winner_id IS NULL
      ORDER BY
        (s1.id NOT IN (SELECT id FROM scored)) DESC,
        (s2.id NOT IN (SELECT id FROM scored)) DESC,
        RANDOM()
      LIMIT 1`,
  );

  const row = (
    args.length === 0 ? stmt.get() : stmt.get(...(args as SQLQueryBindings[]))
  ) as NextPair | undefined;

  return row ?? null;
}

export function recordComparison(
  db: Database,
  winnerId: number,
  loserId: number,
): void {
  db.run(`DELETE FROM todo_comparisons WHERE winner_id = ? AND loser_id = ?`, [
    loserId,
    winnerId,
  ]);

  db.run(
    `INSERT INTO todo_comparisons (winner_id, loser_id, compared_at)
     VALUES (?, ?, strftime('%s', 'now'))
     ON CONFLICT(winner_id, loser_id) DO UPDATE SET compared_at = strftime('%s', 'now')`,
    [winnerId, loserId],
  );
}

function canReach(db: Database, fromId: number, toId: number): boolean {
  const visited = new Set<number>();
  const queue = [fromId];

  while (queue.length > 0) {
    const node = queue.shift()!;

    if (node === toId) {
      return true;
    }

    if (visited.has(node)) {
      continue;
    }

    visited.add(node);

    const next = db
      .prepare(`SELECT loser_id FROM todo_comparisons WHERE winner_id = ?`)
      .all(node) as { loser_id: number }[];

    for (const row of next) {
      queue.push(row.loser_id);
    }
  }

  return false;
}

export function alreadyResolved(
  db: Database,
  aId: number,
  bId: number,
): boolean {
  return canReach(db, aId, bId) || canReach(db, bId, aId);
}

export function wouldContradict(
  db: Database,
  loserId: number,
  winnerId: number,
): boolean {
  return canReach(db, loserId, winnerId);
}

export function resetComparisons(db: Database, parentId: number | null): void {
  const { clause, args } = whereParentIdEquals('parent_id', parentId);

  const stmt = db.prepare(
    `SELECT id FROM todos WHERE ${clause} AND status NOT IN ('done', 'cancelled')`,
  );

  const siblings = (
    args.length === 0 ? stmt.all() : stmt.all(...(args as SQLQueryBindings[]))
  ) as { id: number }[];

  if (siblings.length === 0) {
    return;
  }

  const ids = siblings.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(',');

  db.run(
    `DELETE FROM todo_comparisons
      WHERE winner_id IN (${placeholders})
        AND loser_id IN (${placeholders})`,
    [...ids, ...ids],
  );
}

export function countActiveSiblings(
  db: Database,
  parentId: number | null,
): number {
  const { clause, args } = whereParentIdEquals('parent_id', parentId);

  const stmt = db.prepare(
    `SELECT COUNT(*) AS c FROM todos WHERE ${clause} AND status NOT IN ('done', 'cancelled')`,
  );

  const row = (
    args.length === 0 ? stmt.get() : stmt.get(...(args as SQLQueryBindings[]))
  ) as { c: number };

  return Number(row.c);
}

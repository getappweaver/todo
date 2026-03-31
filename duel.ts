// ---------------------------------------------------------------------------
// plugins/todo/duel.ts — Pairwise todo ranking (duel) utilities and session
// ---------------------------------------------------------------------------

import type { Database, SQLQueryBindings } from 'bun:sqlite';

import { PROMPT_SESSION_EXIT } from '@src/prompt-session';

import { getFocusId, getTodoPathFromScopeToLeaf } from './db';
import { rowToTodo } from './todo-row';
import type { Todo } from './types';

const PATH_STATUS_ICON: Record<string, string> = {
  pending: '[ ]',
  in_progress: '[~]',
  done: '[x]',
  cancelled: '[-]',
};

const PATH_BULLET = '- ';

/** Tree spine matching list format; win rate only on the leaf line (ranked row). */
function formatLeafWithAncestorPath(path: Todo[], leaf: RankedTodo): string {
  if (path.length === 0) {
    return '';
  }

  const lines = path.map((t, i) => {
    const prefix = '  '.repeat(2 * (i + 1));
    const icon = PATH_STATUS_ICON[t.status] ?? '[ ]';
    const runIn = `${PATH_BULLET}${icon} `;
    const isLeafLine = t.id === leaf.id;
    const winPart = isLeafLine ? ` (${formatWinRate(leaf)})` : '';

    return `${prefix}${runIn}${t.todo}${winPart}  (id: ${t.id})`;
  });

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SendReplyFn = (message: string) => Promise<void>;
export type PromptFn = (message: string) => Promise<string>;

export type RankedTodo = Todo & {
  wins: number;
  losses: number;
  win_rate: number | null;
};

export type NextPair = {
  aId: number;
  aTitle: string;
  bId: number;
  bTitle: string;
};

/**
 * SQL fragment for "rows whose parent is this scope". Use `IS NULL` / `= ?` — do not use
 * `parent_id IS ?` with a bound parameter: Bun/sqlite can fail to match rows for non-null ids.
 */
function whereParentIdEquals(
  column: 'parent_id' | 't.parent_id',
  parentId: number | null,
): { clause: string; args: unknown[] } {
  if (parentId === null) {
    return { clause: `${column} IS NULL`, args: [] };
  }

  return { clause: `${column} = ?`, args: [parentId] };
}

// ---------------------------------------------------------------------------
// Parent scope
// ---------------------------------------------------------------------------

/**
 * Sibling scope for duel/next: explicit first arg (parent id), else stored focus, else root
 * (`parent_id IS NULL`).
 */
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

/**
 * All leaf todos in win-rank DFS order (siblings ranked, then recurse into children).
 */
function collectLeavesInDFSOrder(
  db: Database,
  ranked: RankedTodo[],
): RankedTodo[] {
  const out: RankedTodo[] = [];

  for (const t of ranked) {
    const childRanked = getRankedSiblings(db, t.id);

    if (childRanked.length === 0) {
      out.push(t);
    } else {
      out.push(...collectLeavesInDFSOrder(db, childRanked));
    }
  }

  return out;
}

/** First pending leaf strictly after `leaves[0]` in DFS order (the "current" leaf). */
function firstPendingLeafAfterFirst(leaves: RankedTodo[]): RankedTodo | null {
  for (let i = 1; i < leaves.length; i++) {
    if (leaves[i].status === 'pending') {
      return leaves[i];
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Win rate & ranking
// ---------------------------------------------------------------------------

export function formatWinRate(todo: {
  win_rate: number | null;
  wins: number;
  losses: number;
}): string {
  if (todo.win_rate === null) {
    return 'unscored';
  }

  const pct = Math.round(todo.win_rate * 100);
  const wins = todo.wins ?? 0;
  const losses = todo.losses ?? 0;

  return `${pct}%  ${wins}W/${losses}L`;
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
        (SELECT COUNT(*) FROM todo_comparisons w WHERE w.winner_id = t.id) AS wins,
        (SELECT COUNT(*) FROM todo_comparisons l WHERE l.loser_id = t.id) AS losses
      FROM todos t
      WHERE ${clause}
        AND t.status NOT IN ('done', 'cancelled')`,
  );

  const rows = (
    args.length === 0 ? stmt.all() : stmt.all(...(args as SQLQueryBindings[]))
  ) as Record<string, unknown>[];

  const ranked: RankedTodo[] = rows.map((row) => {
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

  ranked.sort(compareSiblings);

  return ranked;
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
        UNION
        SELECT loser_id AS id FROM todo_comparisons
          WHERE loser_id IN (SELECT id FROM siblings)
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

export function resetComparisons(db: Database, parentId: number | null): void {
  const { clause, args } = whereParentIdEquals('parent_id', parentId);

  const stmt = db.prepare(
    `SELECT id FROM todos WHERE ${clause} AND status NOT IN ('done', 'cancelled')`,
  );

  const siblings = (
    args.length === 0 ? stmt.all() : stmt.all(...(args as SQLQueryBindings[]))
  ) as {
    id: number;
  }[];

  if (siblings.length === 0) {
    return;
  }

  const ids = siblings.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');

  db.run(
    `DELETE FROM todo_comparisons
     WHERE winner_id IN (${placeholders})
        OR loser_id IN (${placeholders})`,
    [...ids, ...ids],
  );
}

export function canReach(db: Database, fromId: number, toId: number): boolean {
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

    for (const r of next) {
      queue.push(r.loser_id);
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

// ---------------------------------------------------------------------------
// Duel session & command handlers
// ---------------------------------------------------------------------------

export async function startDuelSession(props: {
  db: Database;
  parentId: number | null;
  sendReply: SendReplyFn;
  promptFn: PromptFn;
}): Promise<void> {
  const { db, parentId, sendReply, promptFn } = props;

  const { clause, args: scopeArgs } = whereParentIdEquals(
    'parent_id',
    parentId,
  );

  const siblingsStmt = db.prepare(
    `SELECT id FROM todos WHERE ${clause} AND status NOT IN ('done', 'cancelled')`,
  );

  const siblings = (
    scopeArgs.length === 0
      ? siblingsStmt.all()
      : siblingsStmt.all(...(scopeArgs as SQLQueryBindings[]))
  ) as { id: number }[];

  if (siblings.length < 2) {
    return;
  }

  while (true) {
    const pair = getNextPair(db, parentId);

    if (!pair) {
      const ranked = getRankedSiblings(db, parentId);

      const answer = await promptFn(
        `✓ All items scored!\n\n` +
          ranked
            .map((t, i) => `${i + 1}. ${t.todo} (${formatWinRate(t)})`)
            .join('\n') +
          `\n\nContinue with a re-duel? (yes/no)`,
      );

      if (answer === PROMPT_SESSION_EXIT) {
        await sendReply(`Duel ended.`);

        return;
      }

      if (answer.toLowerCase().startsWith('y')) {
        await startDuelSession({ db, parentId, sendReply, promptFn });

        return;
      }

      return;
    }

    if (alreadyResolved(db, pair.aId, pair.bId)) {
      const [winnerId, loserId] = canReach(db, pair.aId, pair.bId)
        ? [pair.aId, pair.bId]
        : [pair.bId, pair.aId];

      recordComparison(db, winnerId, loserId);
      continue;
    }

    const answerRaw = await promptFn(
      `Which is more important?\n` +
        `A) ${pair.aTitle}\n` +
        `B) ${pair.bTitle}\n` +
        `(S to skip, Q to quit)`,
    );

    if (answerRaw === PROMPT_SESSION_EXIT) {
      await sendReply(`Duel ended.`);

      return;
    }

    const answer = answerRaw.toUpperCase();

    if (answer === 'Q') {
      await sendReply(`Duel stopped.`);

      return;
    }

    if (answer === 'S') {
      continue;
    }

    if (answer !== 'A' && answer !== 'B') {
      continue;
    }

    const [winnerId, loserId] =
      answer === 'A' ? [pair.aId, pair.bId] : [pair.bId, pair.aId];

    const winnerTitle = answer === 'A' ? pair.aTitle : pair.bTitle;
    const loserTitle = answer === 'A' ? pair.bTitle : pair.aTitle;

    if (canReach(db, loserId, winnerId)) {
      await sendReply(
        `⚠ Contradiction — "${loserTitle}" already ranks above "${winnerTitle}" transitively. Skipping.`,
      );

      continue;
    }

    recordComparison(db, winnerId, loserId);
  }
}

function countActiveSiblings(db: Database, parentId: number | null): number {
  const { clause, args } = whereParentIdEquals('parent_id', parentId);

  const stmt = db.prepare(
    `SELECT COUNT(*) AS c FROM todos WHERE ${clause} AND status NOT IN ('done', 'cancelled')`,
  );

  const row = (
    args.length === 0 ? stmt.get() : stmt.get(...(args as SQLQueryBindings[]))
  ) as {
    c: number;
  };

  return Number(row.c);
}

export async function handleDuelCommand(props: {
  args: string[];
  db: Database;
  sendReply: SendReplyFn;
  promptFn: PromptFn;
}): Promise<string> {
  const { args, db, sendReply, promptFn } = props;
  const reset = args.includes('--reset');
  const cleanArgs = args.filter((a) => a !== '--reset');
  const parentId = getParentId(cleanArgs, db);

  if (countActiveSiblings(db, parentId) < 2) {
    return `Need at least 2 active todos at this level to duel.`;
  }

  if (reset) {
    resetComparisons(db, parentId);
    await startDuelSession({ db, parentId, sendReply, promptFn });

    return `Duel session finished.`;
  }

  if (!getNextPair(db, parentId)) {
    const answer = await promptFn(
      `All items at this level are already scored.\n` +
        `Reset and re-duel? (yes/no)`,
    );

    if (answer === PROMPT_SESSION_EXIT) {
      return `Duel cancelled.`;
    }

    if (!answer.toLowerCase().startsWith('y')) {
      return `OK — no reset.`;
    }

    resetComparisons(db, parentId);
    await startDuelSession({ db, parentId, sendReply, promptFn });

    return `Duel session finished.`;
  }

  if (parentId !== null) {
    const scope = await promptFn(
      `Score item #${parentId} within its siblings, or score its children?\n` +
        `A) within siblings  B) score children`,
    );

    if (scope === PROMPT_SESSION_EXIT) {
      return `Duel cancelled.`;
    }

    const u = scope.toUpperCase();

    if (u === 'A') {
      const parent = db
        .prepare(`SELECT parent_id FROM todos WHERE id = ?`)
        .get(parentId) as { parent_id: number | null } | undefined;

      const duelParent = parent?.parent_id ?? null;

      await startDuelSession({
        db,
        parentId: duelParent,
        sendReply,
        promptFn,
      });

      return `Duel session finished.`;
    }
  }

  await startDuelSession({ db, parentId, sendReply, promptFn });

  return `Duel session finished.`;
}

export async function maybeOfferDuelAfterAdd(props: {
  db: Database;
  parentId: number | null;
  newId: number;
  newTitle: string;
  sendReply: SendReplyFn;
  promptFn: PromptFn;
}): Promise<string | null> {
  const { db, parentId, newId, newTitle, sendReply, promptFn } = props;

  const { clause, args: parentArgs } = whereParentIdEquals(
    'parent_id',
    parentId,
  );

  const siblingsStmt = db.prepare(
    `SELECT id FROM todos WHERE ${clause} AND status NOT IN ('done', 'cancelled') AND id != ?`,
  );

  const bindArgs = [...parentArgs, newId];

  const siblings = siblingsStmt.all(...(bindArgs as SQLQueryBindings[])) as {
    id: number;
  }[];

  if (siblings.length === 0) {
    return null;
  }

  const answer = await promptFn(
    `"${newTitle}" added among ${siblings.length} sibling(s). Want to duel? (yes/no)`,
  );

  if (answer === PROMPT_SESSION_EXIT) {
    return `Duel cancelled.`;
  }

  if (answer.toLowerCase().startsWith('y')) {
    await startDuelSession({ db, parentId, sendReply, promptFn });

    return `Duel session finished.`;
  }

  return null;
}

type MaybePromptDuelUnscoredProps = {
  db: Database;
  parentId: number | null;
  sendReply: SendReplyFn;
  promptFn: PromptFn;
  unscored: RankedTodo[];
};

async function maybePromptDuelForUnscored(
  props: MaybePromptDuelUnscoredProps,
): Promise<string | null> {
  const { db, parentId, sendReply, promptFn, unscored } = props;

  if (unscored.length === 0) {
    return null;
  }

  const answer = await promptFn(
    `⚠ ${unscored.length} item(s) have no comparisons yet.\n` +
      `Score them now for better results? (yes/no)\n` +
      `(If skipped, unscored items are treated as lowest priority.)`,
  );

  if (answer === PROMPT_SESSION_EXIT) {
    return `Cancelled.`;
  }

  if (answer.toLowerCase().startsWith('y')) {
    await startDuelSession({ db, parentId, sendReply, promptFn });

    return `Duel session finished.`;
  }

  return null;
}

type HandleScopeLeafCommandProps = {
  args: string[];
  db: Database;
  sendReply: SendReplyFn;
  promptFn: PromptFn;
};

export async function handleCurrentCommand(
  props: HandleScopeLeafCommandProps,
): Promise<string> {
  const { args, db, sendReply, promptFn } = props;
  const parentId = getParentId(args, db);
  const ranked = getRankedSiblings(db, parentId);
  const unscored = ranked.filter((t) => t.win_rate === null);

  const duelEarly = await maybePromptDuelForUnscored({
    db,
    parentId,
    sendReply,
    promptFn,
    unscored,
  });

  if (duelEarly !== null) {
    return duelEarly;
  }

  const leaves = collectLeavesInDFSOrder(db, ranked);

  if (leaves.length === 0) {
    if (ranked.length === 0) {
      return `No pending items.`;
    }

    return `No leaf items at this scope — every open item still has open subtasks.`;
  }

  const current = leaves[0];
  const path = getTodoPathFromScopeToLeaf(db, current.id, parentId);
  const tree = formatLeafWithAncestorPath(path, current);

  return `Current:\n${tree}`;
}

export async function handleNextCommand(
  props: HandleScopeLeafCommandProps,
): Promise<string> {
  const { args, db, sendReply, promptFn } = props;
  const parentId = getParentId(args, db);
  const ranked = getRankedSiblings(db, parentId);
  const unscored = ranked.filter((t) => t.win_rate === null);

  const duelEarly = await maybePromptDuelForUnscored({
    db,
    parentId,
    sendReply,
    promptFn,
    unscored,
  });

  if (duelEarly !== null) {
    return duelEarly;
  }

  const leaves = collectLeavesInDFSOrder(db, ranked);

  if (leaves.length === 0) {
    if (ranked.length === 0) {
      return `No pending items.`;
    }

    return `No leaf items at this scope — every open item still has open subtasks.`;
  }

  const next = firstPendingLeafAfterFirst(leaves);

  if (!next) {
    return `No more pending leaves queued after the current one in this scope.`;
  }

  const path = getTodoPathFromScopeToLeaf(db, next.id, parentId);
  const tree = formatLeafWithAncestorPath(path, next);

  return `Next:\n${tree}`;
}

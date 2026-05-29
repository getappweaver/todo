import { createHash } from 'node:crypto';

import type { Database, SQLQueryBindings } from 'bun:sqlite';

import { rowToTodo } from '../../db/todo-row';
import { getFocusId } from '../../db/todos';
import type { Todo } from '../../types/todos';

import type {
  ChampionRecord,
  ChampionScope,
  ChampionSource,
  ChampionTodo,
  NextPair,
  RankedTodo,
  StaleChampionCandidate,
} from './representation';

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
  return getNextPairForScope({ db, parentId, skipScopeHash: null });
}

type GetNextPairForScopeProps = {
  db: Database;
  parentId: number | null;
  skipScopeHash: string | null;
};

export function getNextPairForScope({
  db,
  parentId,
  skipScopeHash,
}: GetNextPairForScopeProps): NextPair | null {
  const { clause, args } = whereParentIdEquals('parent_id', parentId);

  const skipClause =
    skipScopeHash === null
      ? ''
      : `AND NOT EXISTS (
          SELECT 1
          FROM todo_comparison_skips skip
          WHERE skip.scope_hash = ?
            AND skip.low_id = CASE WHEN s1.id < s2.id THEN s1.id ELSE s2.id END
            AND skip.high_id = CASE WHEN s1.id < s2.id THEN s2.id ELSE s1.id END
        )`;

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
        ${skipClause}
      ORDER BY
        (s1.id NOT IN (SELECT id FROM scored)) DESC,
        (s2.id NOT IN (SELECT id FROM scored)) DESC,
        RANDOM()
      LIMIT 1`,
  );

  const bindings = skipScopeHash === null ? args : [...args, skipScopeHash];

  const row = (
    bindings.length === 0
      ? stmt.get()
      : stmt.get(...(bindings as SQLQueryBindings[]))
  ) as NextPair | undefined;

  return row ?? null;
}

function comparedPairKey(aId: number, bId: number): string {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
}

function reachableIdsFrom(props: {
  startId: number;
  adjacency: Map<number, number[]>;
}): Set<number> {
  const visited = new Set<number>();
  const queue = [...(props.adjacency.get(props.startId) ?? [])];

  while (queue.length > 0) {
    const id = queue.shift()!;

    if (visited.has(id)) {
      continue;
    }

    visited.add(id);
    queue.push(...(props.adjacency.get(id) ?? []));
  }

  return visited;
}

export function getNextTournamentPairForScope({
  db,
  parentId,
  skipScopeHash,
}: GetNextPairForScopeProps): NextPair | null {
  const ranked = getRankedSiblings(db, parentId);

  if (ranked.length < 2) {
    return null;
  }

  const ids = ranked.map((item) => item.id);
  const idSet = new Set(ids);
  const placeholders = ids.map(() => '?').join(',');

  const rows = db
    .prepare(
      `SELECT winner_id, loser_id
       FROM todo_comparisons
       WHERE winner_id IN (${placeholders})
         AND loser_id IN (${placeholders})`,
    )
    .all(...ids, ...ids) as { winner_id: number; loser_id: number }[];

  const adjacency = new Map<number, number[]>();

  for (const row of rows) {
    if (!idSet.has(row.winner_id) || !idSet.has(row.loser_id)) {
      continue;
    }

    adjacency.set(row.winner_id, [
      ...(adjacency.get(row.winner_id) ?? []),
      row.loser_id,
    ]);
  }

  const skippedPairs = new Set<string>();

  if (skipScopeHash !== null) {
    const skippedRows = db
      .prepare(
        `SELECT low_id, high_id
         FROM todo_comparison_skips
         WHERE scope_hash = ?
           AND low_id IN (${placeholders})
           AND high_id IN (${placeholders})`,
      )
      .all(skipScopeHash, ...ids, ...ids) as {
      low_id: number;
      high_id: number;
    }[];

    for (const row of skippedRows) {
      skippedPairs.add(comparedPairKey(row.low_id, row.high_id));
    }
  }

  const reachById = new Map<number, Set<number>>(
    ranked.map((item) => [
      item.id,
      reachableIdsFrom({ startId: item.id, adjacency }),
    ]),
  );

  const champion = ranked.find(
    (item) => (reachById.get(item.id)?.size ?? 0) >= ranked.length - 1,
  );

  if (champion) {
    return null;
  }

  const leaders = [...ranked].sort((a, b) => {
    const reachDelta =
      (reachById.get(b.id)?.size ?? 0) - (reachById.get(a.id)?.size ?? 0);

    return reachDelta !== 0
      ? reachDelta
      : ranked.indexOf(a) - ranked.indexOf(b);
  });

  for (const leader of leaders) {
    const reachable = reachById.get(leader.id) ?? new Set<number>();

    const challenger = ranked.find(
      (item) =>
        item.id !== leader.id &&
        !reachable.has(item.id) &&
        !skippedPairs.has(comparedPairKey(leader.id, item.id)),
    );

    if (challenger) {
      return {
        aId: leader.id,
        aTitle: leader.todo,
        bId: challenger.id,
        bTitle: challenger.todo,
      };
    }
  }

  return null;
}

export function countSkippedComparisonsInScope(props: {
  db: Database;
  ranked: RankedTodo[];
  scopeHash: string;
}): number {
  if (props.ranked.length < 2) {
    return 0;
  }

  const ids = props.ranked.map((todo) => todo.id);
  const placeholders = ids.map(() => '?').join(',');

  const row = props.db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM todo_comparison_skips
       WHERE scope_hash = ?
         AND low_id IN (${placeholders})
         AND high_id IN (${placeholders})`,
    )
    .get(props.scopeHash, ...ids, ...ids) as { c: number } | undefined;

  return Number(row?.c ?? 0);
}

export function skipComparison(props: {
  db: Database;
  scopeHash: string;
  aId: number;
  bId: number;
}): void {
  const lowId = Math.min(props.aId, props.bId);
  const highId = Math.max(props.aId, props.bId);

  props.db.run(
    `INSERT INTO todo_comparison_skips (scope_hash, low_id, high_id, skipped_at)
     VALUES (?, ?, ?, strftime('%s', 'now'))
     ON CONFLICT(scope_hash, low_id, high_id) DO UPDATE SET
       skipped_at = strftime('%s', 'now')`,
    [props.scopeHash, lowId, highId],
  );
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

function clearComparisonsForItemInScope(props: {
  db: Database;
  itemId: number;
  parentId: number | null;
}): void {
  const siblingIds = getRankedSiblings(props.db, props.parentId)
    .map((sibling) => sibling.id)
    .filter((id) => id !== props.itemId);

  if (siblingIds.length === 0) {
    return;
  }

  const placeholders = siblingIds.map(() => '?').join(',');

  props.db.run(
    `DELETE FROM todo_comparisons
     WHERE (winner_id = ? AND loser_id IN (${placeholders}))
        OR (loser_id = ? AND winner_id IN (${placeholders}))`,
    [props.itemId, ...siblingIds, props.itemId, ...siblingIds],
  );
}

function championScopeKey(parentId: number | null): string {
  return parentId === null ? 'root' : `todo:${parentId}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function getStoredChampion(
  db: Database,
  parentId: number | null,
): ChampionRecord | null {
  const row = db
    .prepare(
      `SELECT scope_key, parent_id, scope_hash, champion_id, source, updated_at
       FROM todo_champions
       WHERE scope_key = ?`,
    )
    .get(championScopeKey(parentId)) as
    | {
        scope_key: string;
        parent_id: number | null;
        scope_hash: string;
        champion_id: number;
        source: ChampionSource;
        updated_at: number;
      }
    | undefined;

  return row
    ? {
        scopeKey: row.scope_key,
        parentId: row.parent_id ?? null,
        scopeHash: row.scope_hash,
        championId: Number(row.champion_id),
        source: row.source,
        updatedAt: Number(row.updated_at),
      }
    : null;
}

function getValidStoredChampion(props: {
  db: Database;
  parentId: number | null;
  scopeHash: string;
}): ChampionRecord | null {
  const stored = getStoredChampion(props.db, props.parentId);

  return stored?.scopeHash === props.scopeHash ? stored : null;
}

function hasValidSkip(props: {
  db: Database;
  parentId: number | null;
  scopeHash: string;
}): boolean {
  const row = props.db
    .prepare(
      `SELECT scope_hash
       FROM todo_champion_skips
       WHERE scope_key = ?`,
    )
    .get(championScopeKey(props.parentId)) as
    | { scope_hash: string }
    | undefined;

  return row?.scope_hash === props.scopeHash;
}

function scopeHashForChildren(children: ChampionTodo[]): string {
  return sha256(
    JSON.stringify(
      [...children]
        .sort((a, b) => a.id - b.id)
        .map((child) => ({
          id: child.id,
          status: child.status,
          updatedAt: child.updated_at,
          championLeafId: child.championLeaf.id,
          championPathIds: child.championPath.map((pathItem) => pathItem.id),
        })),
    ),
  );
}

export function getChampionPath(db: Database, item: RankedTodo): RankedTodo[] {
  const childScope = getChampionScope(db, item.id);

  const stored = getValidStoredChampion({
    db,
    parentId: item.id,
    scopeHash: childScope.scopeHash,
  });

  const storedChild = stored
    ? childScope.children.find((child) => child.id === stored.championId)
    : undefined;

  const championChild =
    storedChild ??
    (childScope.children.length === 1 ? childScope.children[0] : null);

  if (!championChild) {
    return [item];
  }

  return [item, ...championChild.championPath];
}

export function getChampionScope(
  db: Database,
  parentId: number | null,
): ChampionScope {
  const children = getRankedSiblings(db, parentId).map((child) => {
    const championPath = getChampionPath(db, child);

    return {
      ...child,
      championLeaf: championPath[championPath.length - 1],
      championPath,
    };
  });

  const scopeHash = scopeHashForChildren(children);
  const stored = getValidStoredChampion({ db, parentId, scopeHash });

  return {
    parentId,
    scopeHash,
    children,
    currentChampionId: stored?.championId ?? null,
  };
}

export function getStaleChampionCandidate(
  db: Database,
  parentId: number | null,
): StaleChampionCandidate | null {
  const scope = getChampionScope(db, parentId);

  if (scope.currentChampionId !== null) {
    return null;
  }

  const stored = getStoredChampion(db, parentId);

  if (stored === null || stored.scopeHash === scope.scopeHash) {
    return null;
  }

  const champion = scope.children.find(
    (child) => child.id === stored.championId,
  );

  return champion === undefined ? null : { scope, champion, stored };
}

export function findNextChampionScope(
  db: Database,
  parentId: number | null,
): ChampionScope | null {
  const scope = getChampionScope(db, parentId);

  for (const child of scope.children) {
    const unresolved = findNextChampionScope(db, child.id);

    if (unresolved !== null) {
      return unresolved;
    }
  }

  return scope.children.length >= 2 &&
    scope.currentChampionId === null &&
    !hasValidSkip({ db, parentId, scopeHash: scope.scopeHash })
    ? scope
    : null;
}

export function skipChampionScope(props: {
  db: Database;
  parentId: number | null;
  scopeHash: string;
}): void {
  props.db.run(
    `INSERT INTO todo_champion_skips (
       scope_key, parent_id, scope_hash, skipped_at
     ) VALUES (?, ?, ?, strftime('%s', 'now'))
     ON CONFLICT(scope_key) DO UPDATE SET
       parent_id = excluded.parent_id,
       scope_hash = excluded.scope_hash,
       skipped_at = strftime('%s', 'now')`,
    [championScopeKey(props.parentId), props.parentId, props.scopeHash],
  );
}

type ClearChampionScopeSkipsProps = {
  db: Database;
  parentId: number | null;
  scopeHash: string;
};

export function clearChampionScopeSkips({
  db,
  parentId,
  scopeHash,
}: ClearChampionScopeSkipsProps): void {
  db.run(
    `DELETE FROM todo_champion_skips
     WHERE scope_key = ?
       AND scope_hash = ?`,
    [championScopeKey(parentId), scopeHash],
  );

  db.run(`DELETE FROM todo_comparison_skips WHERE scope_hash = ?`, [scopeHash]);
}

export function setChampion(props: {
  db: Database;
  parentId: number | null;
  scopeHash: string;
  championId: number;
  source: ChampionSource;
}): void {
  writeChampion(props);

  if (props.parentId !== null) {
    const parent = props.db
      .prepare(`SELECT parent_id FROM todos WHERE id = ?`)
      .get(props.parentId) as { parent_id: number | null } | undefined;

    const parentScopeId = parent?.parent_id ?? null;

    clearComparisonsForItemInScope({
      db: props.db,
      itemId: props.parentId,
      parentId: parentScopeId,
    });

    const parentScope = getChampionScope(props.db, parentScopeId);

    clearChampionScopeSkips({
      db: props.db,
      parentId: parentScopeId,
      scopeHash: parentScope.scopeHash,
    });
  }
}

export function keepChampion(props: {
  db: Database;
  parentId: number | null;
  scopeHash: string;
  championId: number;
  source: ChampionSource;
}): void {
  writeChampion(props);
}

function writeChampion(props: {
  db: Database;
  parentId: number | null;
  scopeHash: string;
  championId: number;
  source: ChampionSource;
}): void {
  props.db.run(
    `INSERT INTO todo_champions (
       scope_key, parent_id, scope_hash, champion_id, source, updated_at
     ) VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
     ON CONFLICT(scope_key) DO UPDATE SET
       parent_id = excluded.parent_id,
       scope_hash = excluded.scope_hash,
       champion_id = excluded.champion_id,
       source = excluded.source,
       updated_at = strftime('%s', 'now')`,
    [
      championScopeKey(props.parentId),
      props.parentId,
      props.scopeHash,
      props.championId,
      props.source,
    ],
  );

  props.db.run(`DELETE FROM todo_champion_skips WHERE scope_key = ?`, [
    championScopeKey(props.parentId),
  ]);

  const siblings = getRankedSiblings(props.db, props.parentId);

  for (const sibling of siblings) {
    if (sibling.id !== props.championId) {
      recordComparison(props.db, props.championId, sibling.id);
    }
  }
}

export function resetChampionScope(
  db: Database,
  parentId: number | null,
): void {
  const scope = getChampionScope(db, parentId);

  db.run(`DELETE FROM todo_champions WHERE scope_key = ?`, [
    championScopeKey(parentId),
  ]);

  db.run(`DELETE FROM todo_champion_skips WHERE scope_key = ?`, [
    championScopeKey(parentId),
  ]);

  db.run(`DELETE FROM todo_comparison_skips WHERE scope_hash = ?`, [
    scope.scopeHash,
  ]);

  resetComparisons(db, parentId);

  if (parentId !== null) {
    const parent = db
      .prepare(`SELECT parent_id FROM todos WHERE id = ?`)
      .get(parentId) as { parent_id: number | null } | undefined;

    clearComparisonsForItemInScope({
      db,
      itemId: parentId,
      parentId: parent?.parent_id ?? null,
    });
  }
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

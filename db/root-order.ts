import { createHash } from 'node:crypto';

import type { Database } from 'bun:sqlite';

type RootOrderState = {
  itemIds: number[];
  revision: number;
};

export type RootOrderSnapshot = {
  rootIds: number[];
  activeRootIds: number[];
  orderRevision: string;
};

type SaveRootOrderProps = {
  db: Database;
  itemIds: number[];
};

type ReorderRootsProps = {
  db: Database;
  order: number[];
  revision: string;
};

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isActiveStatus(status: string): boolean {
  return status !== 'done' && status !== 'cancelled';
}

export function readRootOrderState(db: Database): RootOrderState {
  const row = db
    .prepare('SELECT item_ids, revision FROM todo_root_order WHERE id = 1')
    .get() as { item_ids: string; revision: number } | undefined;

  if (!row) {
    return { itemIds: [], revision: 0 };
  }

  const parsed = JSON.parse(row.item_ids) as unknown;

  const itemIds = Array.isArray(parsed)
    ? parsed
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];

  return {
    itemIds,
    revision: Number(row.revision ?? 0),
  };
}

export function saveRootOrder({ db, itemIds }: SaveRootOrderProps): void {
  db.run(
    `INSERT INTO todo_root_order (id, item_ids, revision)
     VALUES (1, ?, 1)
     ON CONFLICT(id) DO UPDATE SET
       item_ids = excluded.item_ids,
       revision = todo_root_order.revision + 1`,
    [JSON.stringify(itemIds)],
  );
}

export function getRootOrderSnapshot(db: Database): RootOrderSnapshot {
  const state = readRootOrderState(db);

  const roots = db
    .prepare(
      `SELECT id, status
       FROM todos
       WHERE parent_id IS NULL
       ORDER BY
         CASE WHEN sort_order IS NULL THEN 0 ELSE 1 END,
         sort_order ASC,
         created_at ASC,
         id ASC`,
    )
    .all() as { id: number; status: string }[];

  const rootById = new Map(roots.map((row) => [Number(row.id), row]));
  const known = state.itemIds.filter((id) => rootById.has(id));
  const knownSet = new Set(known);

  const rootIds = [
    ...known,
    ...roots.map((row) => Number(row.id)).filter((id) => !knownSet.has(id)),
  ];

  const activeRootIds = rootIds.filter((id) => {
    const row = rootById.get(id);

    return row !== undefined && isActiveStatus(row.status);
  });

  return {
    rootIds,
    activeRootIds,
    orderRevision: fingerprint([rootIds, activeRootIds, state.revision]),
  };
}

export function reorderRoots({ db, order, revision }: ReorderRootsProps): void {
  db.transaction(() => {
    const current = getRootOrderSnapshot(db);

    if (revision !== current.orderRevision) {
      throw new Error('Root order changed. Refresh before reordering.');
    }

    const subsetSet = new Set(order);
    const activeSet = new Set(current.activeRootIds);

    if (
      subsetSet.size !== order.length ||
      order.some((id) => !activeSet.has(id))
    ) {
      throw new Error('Reorder contains invalid or duplicate root IDs.');
    }

    let index = 0;

    const fullOrder = current.rootIds.map((id) =>
      subsetSet.has(id) ? order[index++] : id,
    );

    saveRootOrder({ db, itemIds: fullOrder });
  })();
}

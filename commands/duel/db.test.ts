import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';

import type { WebNodeRoot } from '@src/web/ui-schema';

import { createTodoTable } from '../../db/open';

import {
  findNextChampionScope,
  getChampionScope,
  getNextTournamentPairForScope,
  getResolvedChampionChildren,
  recordComparison,
  recordComparisonWithPrecedence,
  setChampion,
  skipChampionScope,
  wouldContradict,
} from './db';
import { handleDuelWebAction } from './web';

type InsertTodoProps = {
  db: Database;
  id: number;
  parentId: number | null;
  todo: string;
  status: 'pending' | 'done';
  sortOrder: number;
};

function insertTodo({
  db,
  id,
  parentId,
  todo,
  status,
  sortOrder,
}: InsertTodoProps): void {
  db.run(
    `INSERT INTO todos (
       id, parent_id, todo, status, sort_order, description, tags, source,
       created_at, updated_at, completed_at
     ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, NULL)`,
    [id, parentId, todo, status, sortOrder, id],
  );
}

function createDb(): Database {
  const db = new Database(':memory:', { strict: true });

  db.run('PRAGMA foreign_keys = ON');
  createTodoTable(db);

  return db;
}

function collectTextAndLabels(root: WebNodeRoot): string[] {
  const values: string[] = [];

  function visit(node: unknown): void {
    if (node === null || typeof node !== 'object') {
      return;
    }

    if ('type' in node && node.type === 'text' && 'value' in node) {
      values.push(String(node.value));
    }

    if ('props' in node && node.props && typeof node.props === 'object') {
      const label = (node.props as { label?: unknown }).label;

      if (typeof label === 'string') {
        values.push(label);
      }
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else {
        visit(value);
      }
    }
  }

  visit(root.tree);

  return values;
}

describe('todo champion prioritization', () => {
  test('skipping a child branch without a champion keeps dueling remaining champion representatives', () => {
    const db = createDb();

    try {
      insertTodo({
        db,
        id: 1,
        parentId: null,
        todo: 'WEB',
        status: 'pending',
        sortOrder: 1,
      });

      insertTodo({
        db,
        id: 2,
        parentId: null,
        todo: 'BOT',
        status: 'pending',
        sortOrder: 2,
      });

      insertTodo({
        db,
        id: 3,
        parentId: null,
        todo: 'WALLET',
        status: 'pending',
        sortOrder: 3,
      });

      insertTodo({
        db,
        id: 10,
        parentId: 1,
        todo: 'Old WEB winner',
        status: 'pending',
        sortOrder: 1,
      });

      insertTodo({
        db,
        id: 11,
        parentId: 1,
        todo: 'New WEB candidate A',
        status: 'pending',
        sortOrder: 2,
      });

      insertTodo({
        db,
        id: 12,
        parentId: 1,
        todo: 'New WEB candidate B',
        status: 'pending',
        sortOrder: 3,
      });

      const webScopeBeforeDone = getChampionScope(db, 1);

      setChampion({
        db,
        parentId: 1,
        scopeHash: webScopeBeforeDone.scopeHash,
        championId: 10,
        source: 'prioritize',
      });

      const rootScopeBeforeDone = getChampionScope(db, null);

      setChampion({
        db,
        parentId: null,
        scopeHash: rootScopeBeforeDone.scopeHash,
        championId: 1,
        source: 'prioritize',
      });

      db.run(`UPDATE todos SET status = 'done' WHERE id = 10`);

      const skippedWebScope = getChampionScope(db, 1);

      skipChampionScope({
        db,
        parentId: 1,
        scopeHash: skippedWebScope.scopeHash,
      });

      const nextScope = findNextChampionScope(db, null);

      const representativeChildren =
        nextScope === null ? [] : getResolvedChampionChildren(db, nextScope);

      expect(nextScope?.parentId).toBe(null);
      expect(nextScope?.children.map((child) => child.id)).toEqual([1, 2, 3]);
      expect(representativeChildren.map((child) => child.id)).toEqual([2, 3]);

      const pair = getNextTournamentPairForScope({
        db,
        parentId: null,
        skipScopeHash: nextScope?.scopeHash ?? '',
        ranked: representativeChildren,
      });

      expect(pair).not.toBeNull();
      expect([pair?.aId, pair?.bId]).not.toContain(1);
    } finally {
      db.close();
    }
  });

  test('champion scope choices include direct children with unresolved child branches', () => {
    const db = createDb();

    try {
      insertTodo({
        db,
        id: 44,
        parentId: null,
        todo: 'TODOs',
        status: 'pending',
        sortOrder: 1,
      });

      insertTodo({
        db,
        id: 285,
        parentId: 44,
        todo: 'Show only champions flat',
        status: 'pending',
        sortOrder: 1,
      });

      insertTodo({
        db,
        id: 122,
        parentId: 44,
        todo: 'todo add XXX status',
        status: 'pending',
        sortOrder: 2,
      });

      insertTodo({
        db,
        id: 226,
        parentId: 44,
        todo: 'DUEL',
        status: 'pending',
        sortOrder: 3,
      });

      insertTodo({
        db,
        id: 284,
        parentId: 44,
        todo: 'Story accent colored winner',
        status: 'pending',
        sortOrder: 4,
      });

      insertTodo({
        db,
        id: 288,
        parentId: 44,
        todo: 'Add child on champion',
        status: 'pending',
        sortOrder: 5,
      });

      insertTodo({
        db,
        id: 290,
        parentId: 288,
        todo: "Can't keep the old parent champion",
        status: 'pending',
        sortOrder: 1,
      });

      insertTodo({
        db,
        id: 293,
        parentId: 288,
        todo: 'test',
        status: 'pending',
        sortOrder: 2,
      });

      const todosScope = getChampionScope(db, 44);

      setChampion({
        db,
        parentId: 44,
        scopeHash: todosScope.scopeHash,
        championId: 285,
        source: 'prioritize',
      });

      const refreshPickScope = getChampionScope(db, 44);

      expect(refreshPickScope.children.map((child) => child.id)).toEqual([
        285, 122, 226, 284, 288,
      ]);
    } finally {
      db.close();
    }
  });

  test('later priority choices replace the contradicting chain', () => {
    const db = createDb();

    try {
      insertTodo({
        db,
        id: 1,
        parentId: null,
        todo: 'A',
        status: 'pending',
        sortOrder: 1,
      });

      insertTodo({
        db,
        id: 2,
        parentId: null,
        todo: 'B',
        status: 'pending',
        sortOrder: 2,
      });

      insertTodo({
        db,
        id: 3,
        parentId: null,
        todo: 'C',
        status: 'pending',
        sortOrder: 3,
      });

      recordComparison(db, 1, 2);
      recordComparison(db, 2, 3);

      expect(wouldContradict(db, 1, 3)).toBe(true);

      recordComparisonWithPrecedence({ db, winnerId: 3, loserId: 1 });

      const comparisons = db
        .prepare(
          `SELECT winner_id, loser_id
           FROM todo_comparisons
           ORDER BY winner_id, loser_id`,
        )
        .all() as { winner_id: number; loser_id: number }[];

      expect(comparisons).toEqual([{ winner_id: 3, loser_id: 1 }]);
      expect(wouldContradict(db, 1, 3)).toBe(false);
    } finally {
      db.close();
    }
  });

  test('stale champion prompt is merged into the champion pick screen', () => {
    const db = createDb();

    try {
      insertTodo({
        db,
        id: 44,
        parentId: null,
        todo: 'TODOs',
        status: 'pending',
        sortOrder: 1,
      });

      insertTodo({
        db,
        id: 288,
        parentId: 44,
        todo: 'Add child on champion',
        status: 'pending',
        sortOrder: 1,
      });

      insertTodo({
        db,
        id: 285,
        parentId: 44,
        todo: 'Show only champions flat',
        status: 'pending',
        sortOrder: 2,
      });

      insertTodo({
        db,
        id: 290,
        parentId: 288,
        todo: "Can't keep the old parent champion",
        status: 'pending',
        sortOrder: 1,
      });

      insertTodo({
        db,
        id: 293,
        parentId: 288,
        todo: 'test',
        status: 'pending',
        sortOrder: 2,
      });

      const todosScope = getChampionScope(db, 44);

      setChampion({
        db,
        parentId: 44,
        scopeHash: todosScope.scopeHash,
        championId: 288,
        source: 'prioritize',
      });

      insertTodo({
        db,
        id: 305,
        parentId: 288,
        todo: 'test 2',
        status: 'pending',
        sortOrder: 3,
      });

      insertTodo({
        db,
        id: 306,
        parentId: 44,
        todo: 'test 3',
        status: 'pending',
        sortOrder: 3,
      });

      const childScope = getChampionScope(db, 288);

      skipChampionScope({
        db,
        parentId: 288,
        scopeHash: childScope.scopeHash,
      });

      const root = handleDuelWebAction({
        db,
        commandAlias: 'todo',
        parentId: null,
        actionArgs: ['prioritizeFlow', 'returnRoot', 'root'],
      });

      const labels = collectTextAndLabels(root);

      expect(labels).toContain('Keep highlighted');
      expect(labels).toContain('Pick');
      expect(labels).toContain('Add child on champion');
      expect(labels).toContain('Show only champions flat');
      expect(labels).toContain('test 3');
      expect(labels).not.toContain('Pick new');
    } finally {
      db.close();
    }
  });
});

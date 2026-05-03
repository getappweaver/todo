import { join } from 'path';

import { Database } from 'bun:sqlite';

import { createTodoDraftsTable } from './drafts';

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

  if (cols.some((column) => column.name === 'priority')) {
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

export function openDb(): Database {
  const db = new Database(join(import.meta.dir, '..', 'db.sqlite'), {
    strict: true,
  });

  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode=WAL');
  createTodoTable(db);
  createTodoDraftsTable(db);

  return db;
}

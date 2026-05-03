import { randomUUID } from 'node:crypto';

import type { Database } from 'bun:sqlite';

import { assertUnreachable } from '@src/utils';

import type {
  CreateTodoDraft,
  StoreDraftEntry,
  TodoDraftEntry,
  TodoDraftRow,
} from '../types/drafts';
import type { UpdateTodoInput } from '../types/todos';

export type { CreateTodoDraft, StoreDraftEntry, TodoDraftEntry, TodoDraftRow };

export function createDraftSessionId(): string {
  return randomUUID();
}

export function createTodoDraftsTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS todo_drafts (
      id              INTEGER PRIMARY KEY,
      session_id      TEXT NOT NULL,
      kind            TEXT NOT NULL,
      input           TEXT NOT NULL,
      original_prompt TEXT NOT NULL DEFAULT '',
      created_at      INTEGER NOT NULL
    )
  `);
}

export function storeDraft(db: Database, entry: StoreDraftEntry): number {
  const now = Date.now();

  const info = db.run(
    `INSERT INTO todo_drafts (session_id, kind, input, original_prompt, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      entry.sessionId,
      entry.kind,
      JSON.stringify(entry.input),
      entry.originalPrompt,
      now,
    ],
  );

  return Number(info.lastInsertRowid);
}

export function getDraft(db: Database, id: number): TodoDraftRow | null {
  const row = db.prepare('SELECT * FROM todo_drafts WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;

  return row ? rowToDraft(row) : null;
}

export function listDrafts(db: Database): TodoDraftRow[] {
  const rows = db
    .prepare('SELECT * FROM todo_drafts ORDER BY id ASC')
    .all() as Record<string, unknown>[];

  return rows.map(rowToDraft);
}

export function listDraftsBySession(
  db: Database,
  sessionId: string,
): TodoDraftRow[] {
  const rows = db
    .prepare('SELECT * FROM todo_drafts WHERE session_id = ? ORDER BY id ASC')
    .all(sessionId) as Record<string, unknown>[];

  return rows.map(rowToDraft);
}

export function getDraftBySessionIndex(
  db: Database,
  sessionId: string,
  index: number,
): TodoDraftRow | null {
  return listDraftsBySession(db, sessionId)[index] ?? null;
}

export function deleteDraft(db: Database, id: number): boolean {
  return db.prepare('DELETE FROM todo_drafts WHERE id = ?').run(id).changes > 0;
}

export function updateDraftInput(
  db: Database,
  id: number,
  input: TodoDraftEntry['input'],
): boolean {
  const info = db
    .prepare('UPDATE todo_drafts SET input = ? WHERE id = ?')
    .run(JSON.stringify(input), id);

  return info.changes > 0;
}

export function updateDraftEntry(
  db: Database,
  id: number,
  entry: TodoDraftEntry,
): boolean {
  const info = db
    .prepare(
      'UPDATE todo_drafts SET kind = ?, input = ?, original_prompt = ? WHERE id = ?',
    )
    .run(entry.kind, JSON.stringify(entry.input), entry.originalPrompt, id);

  return info.changes > 0;
}

function rowToDraft(row: Record<string, unknown>): TodoDraftRow {
  const kind = String(row.kind) as TodoDraftEntry['kind'];
  const input = JSON.parse(String(row.input));
  const originalPrompt = String(row.original_prompt);
  const id = Number(row.id);
  const sessionId = String(row.session_id);
  const createdAt = Number(row.created_at);

  if (kind === 'create') {
    return {
      id,
      sessionId,
      createdAt,
      kind,
      input: input as CreateTodoDraft,
      originalPrompt,
    };
  }

  if (kind === 'update') {
    return {
      id,
      sessionId,
      createdAt,
      kind,
      input: input as UpdateTodoInput,
      originalPrompt,
    };
  }

  if (kind === 'delete') {
    return {
      id,
      sessionId,
      createdAt,
      kind,
      input: input as { id: number },
      originalPrompt,
    };
  }

  return assertUnreachable(kind);
}

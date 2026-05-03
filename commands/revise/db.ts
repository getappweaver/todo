import type { Database } from 'bun:sqlite';

import {
  createDraftSessionId,
  deleteDraft,
  getDraft,
  storeDraft,
} from '../../db/drafts';
import { listTodos } from '../../db/todos';
import type { Todo } from '../../types/todos';

export function getTodoDraft(db: Database, id: number) {
  return getDraft(db, id);
}

export function deleteTodoDraft(db: Database, id: number): boolean {
  return deleteDraft(db, id);
}

export function storeTodoDraft(
  db: Database,
  entry: Parameters<typeof storeDraft>[1],
): number {
  return storeDraft(db, entry);
}

export function createTodoDraftSessionId(): string {
  return createDraftSessionId();
}

export function listAllTodos(db: Database): Todo[] {
  return listTodos(db);
}

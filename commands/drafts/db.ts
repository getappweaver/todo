import type { Database } from 'bun:sqlite';

import { getDraft, listDrafts, type TodoDraftRow } from '../../db/drafts';
import { getTodo } from '../../db/todos';
import type { Todo } from '../../types/todos';

export { type TodoDraftRow };

export function getTodoDraft(db: Database, id: number): TodoDraftRow | null {
  return getDraft(db, id);
}

export function listTodoDrafts(db: Database): TodoDraftRow[] {
  return listDrafts(db);
}

export function getTodoById(db: Database, id: number): Todo | null {
  return getTodo(db, id);
}

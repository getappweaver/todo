import type { Database } from 'bun:sqlite';

import {
  deleteDraft,
  getDraft,
  listDrafts,
  type TodoDraftRow,
} from '../../db/drafts';
import {
  createTodosFromDraftTree,
  deleteTodo,
  getTodo,
  updateTodo,
} from '../../db/todos';
import type { Todo } from '../../types/todos';

export { type Todo, type TodoDraftRow };

export function getTodoDraft(db: Database, id: number): TodoDraftRow | null {
  return getDraft(db, id);
}

export function listTodoDrafts(db: Database): TodoDraftRow[] {
  return listDrafts(db);
}

export function deleteTodoDraft(db: Database, id: number): boolean {
  return deleteDraft(db, id);
}

export function createTodosFromDraft(
  db: Database,
  draft: TodoDraftRow,
): Todo[] {
  return draft.kind === 'create'
    ? createTodosFromDraftTree(db, draft.input, 'dm')
    : [];
}

export function updateTodoFromDraft(
  db: Database,
  draft: TodoDraftRow,
): Todo | null {
  return draft.kind === 'update' ? updateTodo(db, draft.input) : null;
}

export function deleteTodoFromDraft(
  db: Database,
  draft: TodoDraftRow,
): boolean {
  return draft.kind === 'delete' ? deleteTodo(db, draft.input.id) : false;
}

export function getTodoById(db: Database, id: number): Todo | null {
  return getTodo(db, id);
}

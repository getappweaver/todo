import type { Database } from 'bun:sqlite';

import { updateTodo as updateTodoById } from '../../db/todos';
import type { Todo } from '../../types/todos';

export function startTodo(db: Database, id: number): Todo | null {
  return updateTodoById(db, { id, status: 'in_progress' });
}

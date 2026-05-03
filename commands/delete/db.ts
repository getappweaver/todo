import type { Database } from 'bun:sqlite';

import { deleteTodo as deleteTodoById } from '../../db/todos';

export function deleteTodo(db: Database, id: number): boolean {
  return deleteTodoById(db, id);
}

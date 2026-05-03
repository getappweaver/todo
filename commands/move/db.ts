import type { Database } from 'bun:sqlite';

import {
  getTodo as getTodoById,
  moveTodo as moveTodoById,
  type MoveTodoResult,
} from '../../db/todos';
import type { Todo } from '../../types/todos';

export function getTodo(db: Database, id: number): Todo | null {
  return getTodoById(db, id);
}

export function moveTodo(
  db: Database,
  id: number,
  newParentId: number | null,
): MoveTodoResult {
  return moveTodoById(db, id, newParentId);
}

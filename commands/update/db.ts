import type { Database } from 'bun:sqlite';

import {
  getTodo as getTodoById,
  updateTodo as updateTodoByInput,
} from '../../db/todos';
import type { Todo, UpdateTodoInput } from '../../types/todos';

export function getTodo(db: Database, id: number): Todo | null {
  return getTodoById(db, id);
}

export function updateTodo(db: Database, input: UpdateTodoInput): Todo | null {
  return updateTodoByInput(db, input);
}

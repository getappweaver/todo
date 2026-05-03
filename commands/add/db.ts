import type { Database } from 'bun:sqlite';

import {
  createTodo as createTodoByInput,
  getTodo as getTodoById,
} from '../../db/todos';
import type { Todo } from '../../types/todos';

export function createTodo(params: {
  db: Database;
  text: string;
  parentId: number | null;
}): Todo {
  return createTodoByInput(
    params.db,
    {
      todo: params.text,
      parent_id: params.parentId,
      description: null,
      tags: null,
    },
    'dm',
  );
}

export function getTodo(db: Database, id: number): Todo | null {
  return getTodoById(db, id);
}

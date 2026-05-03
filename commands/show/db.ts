import type { Database } from 'bun:sqlite';

import { getTodo as getTodoById } from '../../db/todos';
import type { Todo } from '../../types/todos';

export function getTodo(db: Database, id: number): Todo | null {
  return getTodoById(db, id);
}

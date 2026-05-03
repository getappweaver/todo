import type { Database } from 'bun:sqlite';

import {
  getTodo as getTodoById,
  setFocusId as setFocusTodoId,
} from '../../db/todos';
import type { Todo } from '../../types/todos';

export function getTodo(db: Database, id: number): Todo | null {
  return getTodoById(db, id);
}

export function setFocusId(db: Database, id: number): void {
  setFocusTodoId(db, id);
}

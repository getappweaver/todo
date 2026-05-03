import type { Database } from 'bun:sqlite';

import {
  getFocusId as getFocusTodoId,
  getTodo as getTodoById,
  listTodos as listAllTodos,
  listTodosInSubtree as listTodosForSubtree,
} from '../../db/todos';
import type { Todo, TodoWithWinStats } from '../../types/todos';

export function getFocusId(db: Database): number | null {
  return getFocusTodoId(db);
}

export function getTodo(db: Database, id: number): Todo | null {
  return getTodoById(db, id);
}

export function listTodos(db: Database): TodoWithWinStats[] {
  return listAllTodos(db);
}

export function listTodosInSubtree(
  db: Database,
  rootId: number,
): TodoWithWinStats[] {
  return listTodosForSubtree(db, rootId);
}

export function isActiveListTodo(todo: { status: string }): boolean {
  return todo.status !== 'done' && todo.status !== 'cancelled';
}

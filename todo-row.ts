// ---------------------------------------------------------------------------
// plugins/todo/todo-row.ts — Map SQLite rows to Todo
// ---------------------------------------------------------------------------

import type { Todo, TodoStatus } from './types';

export function rowToTodo(row: Record<string, unknown>): Todo {
  return {
    id: Number(row.id),
    parent_id: row.parent_id != null ? Number(row.parent_id) : null,
    todo: String(row.todo),
    status: String(row.status) as TodoStatus,
    sort_order: row.sort_order != null ? Number(row.sort_order) : null,
    description: row.description != null ? String(row.description) : null,
    tags: row.tags != null ? (JSON.parse(String(row.tags)) as string[]) : null,
    source: row.source != null ? String(row.source) : null,
    created_at: Number(row.created_at),
    updated_at: row.updated_at != null ? Number(row.updated_at) : null,
    completed_at: row.completed_at != null ? Number(row.completed_at) : null,
  };
}

type TodoDetailLike = {
  id: number;
  parent_id: number | null;
  todo: string;
  status: string;
  tags: string[] | null;
  description: string | null;
  created_at: number;
  updated_at: number | null;
  completed_at: number | null;
};

export function formatTodoDetail(todo: TodoDetailLike): string {
  return [
    `ID:          ${todo.id}`,
    `Todo:        ${todo.todo}`,
    `Status:      ${todo.status}`,
    `Parent:      ${todo.parent_id ?? '(top-level)'}`,
    `Tags:        ${todo.tags?.join(', ') ?? '—'}`,
    `Description: ${todo.description ?? '—'}`,
    `Created:     ${new Date(todo.created_at).toLocaleString()}`,
    `Updated:     ${todo.updated_at ? new Date(todo.updated_at).toLocaleString() : '—'}`,
    `Completed:   ${todo.completed_at ? new Date(todo.completed_at).toLocaleString() : '—'}`,
  ].join('\n');
}

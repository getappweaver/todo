import type { Todo, TodoStatus, TodoWithWinStats } from '../../types/todos';

const BULLET = '- ';

export const TODO_STATUS_ICON: Record<string, string> = {
  pending: '[ ]',
  in_progress: '[~]',
  done: '[x]',
  cancelled: '[-]',
};

export function isActiveListTodo(todo: { status: string }): boolean {
  return todo.status !== 'done' && todo.status !== 'cancelled';
}

export function filterTodosForListTool(
  todos: Todo[],
  filter: TodoStatus[] | undefined,
): Todo[] {
  if (filter === undefined) {
    return todos.filter(isActiveListTodo);
  }

  return todos.filter((todo) => filter.includes(todo.status));
}

function buildChildMap(todos: Todo[]): Map<number | null, Todo[]> {
  const map = new Map<number | null, Todo[]>();

  for (const todo of todos) {
    const key = todo.parent_id ?? null;

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key)!.push(todo);
  }

  return map;
}

function winLine(todo: Todo): string {
  const withStats = todo as TodoWithWinStats;

  return withStats.win_rate === null ? ' (unscored)' : '';
}

export function formatTodoSubtreeListHeader(
  rootId: number,
  rootTitle: string,
): string {
  const safe = rootTitle.replace(/\s+/g, ' ').trim() || '(unknown)';

  return `Focus to: #${rootId} "${safe}"\ntype "!todo unfocus" to return to top-level\n\n`;
}

export function formatTodoTree(
  todos: Todo[],
  showDescriptions: boolean,
  subtreeRootId?: number | null,
): string {
  if (todos.length === 0) {
    return 'No todos.';
  }

  const subtreeHeader =
    subtreeRootId != null
      ? formatTodoSubtreeListHeader(
          subtreeRootId,
          todos.find((todo) => todo.id === subtreeRootId)?.todo ?? '(unknown)',
        )
      : '';

  const toRender =
    subtreeRootId != null
      ? todos.map((todo) =>
          todo.id === subtreeRootId ? { ...todo, parent_id: null } : todo,
        )
      : todos;

  const childMap = buildChildMap(toRender);
  const lines: string[] = [];

  function render(parentId: number | null, prefix: string): void {
    const children = childMap.get(parentId) ?? [];

    for (const todo of children) {
      const icon = TODO_STATUS_ICON[todo.status] ?? '[ ]';
      const runIn = `${BULLET}${icon} `;

      lines.push(
        `${prefix}${runIn}${todo.todo}${winLine(todo)} (id: ${todo.id})`,
      );

      if (showDescriptions && todo.description?.trim()) {
        const descIndent = prefix + ' '.repeat(runIn.length);

        for (const line of todo.description.trim().split('\n')) {
          lines.push(`${descIndent}${line}`);
        }
      }

      render(todo.id, prefix + '  ');
    }
  }

  render(null, '  ');

  return subtreeHeader + lines.join('\n');
}

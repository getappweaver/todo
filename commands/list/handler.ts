import type { Database } from 'bun:sqlite';

import type { Todo, TodoWithWinStats } from '../../types/todos';

import {
  getFocusId,
  getTodo,
  isActiveListTodo,
  listTodos,
  listTodosInSubtree,
} from './db';
import {
  formatListStatusFilterChoices,
  type ListStatusFilter,
  ListStatusFilterSchema,
} from './status';

function treeDepth(db: Database, todo: Todo): number {
  let depth = 0;
  let parentId = todo.parent_id;

  while (parentId !== null) {
    depth++;
    const parent = getTodo(db, parentId);

    if (!parent) {
      break;
    }

    parentId = parent.parent_id;
  }

  return depth;
}

function relativeDepth(
  db: Database,
  todo: Todo,
  rootId: number | null,
): number {
  const depth = treeDepth(db, todo);

  if (rootId === null) {
    return depth;
  }

  const root = getTodo(db, rootId);

  if (!root) {
    return depth;
  }

  return Math.max(0, depth - treeDepth(db, root));
}

function parseOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function parseOptionalBoolean(value: unknown): boolean {
  return value === true;
}

function parseOptionalFilters(value: unknown): string[] | null {
  if (typeof value === 'string') {
    return [value.toLowerCase()];
  }

  if (Array.isArray(value)) {
    const filters = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.toLowerCase());

    return filters.length > 0 ? filters : null;
  }

  return null;
}

function getListUsage(prefix: string, alias: string): string {
  return `${prefix}${alias} list [<id>] [--status ${formatListStatusFilterChoices()}] [--flat] [--desc] [--level <n>]`;
}

function filterTodosWithTreeContext(
  todos: TodoWithWinStats[],
  statuses: Set<string>,
): TodoWithWinStats[] {
  const byId = new Map(todos.map((todo) => [todo.id, todo]));
  const descendantsByParent = new Map<number, TodoWithWinStats[]>();
  const included = new Set<number>();

  for (const todo of todos) {
    if (todo.parent_id === null) {
      continue;
    }

    const siblings = descendantsByParent.get(todo.parent_id) ?? [];
    siblings.push(todo);
    descendantsByParent.set(todo.parent_id, siblings);
  }

  function includeAncestors(todo: TodoWithWinStats): void {
    let parentId = todo.parent_id;

    while (parentId !== null) {
      const parent = byId.get(parentId);

      if (!parent) {
        return;
      }

      included.add(parent.id);
      parentId = parent.parent_id;
    }
  }

  function includeDescendants(todoId: number): void {
    for (const child of descendantsByParent.get(todoId) ?? []) {
      included.add(child.id);
      includeDescendants(child.id);
    }
  }

  for (const todo of todos) {
    if (!statuses.has(todo.status)) {
      continue;
    }

    included.add(todo.id);
    includeAncestors(todo);
    includeDescendants(todo.id);
  }

  return todos.filter((todo) => included.has(todo.id));
}

export type ListCommandResult =
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'empty';
      scope: { rootId: number; rootTitle: string } | null;
      view: 'tree' | 'flat';
      showDescriptions: boolean;
      message: string;
    }
  | {
      type: 'success';
      scope: { rootId: number; rootTitle: string } | null;
      view: 'tree' | 'flat';
      showDescriptions: boolean;
      items: Array<{
        id: number;
        parentId: number | null;
        text: string;
        status: Todo['status'];
        description: string | null;
        depth: number;
        wins: number;
        losses: number;
        winRate: number | null;
      }>;
    };

export function handleListCommand(params: {
  prefix: string;
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
  options: Record<string, unknown>;
}): ListCommandResult {
  const explicitRootId = parseOptionalInteger(params.arguments.rootId);
  const rootId = explicitRootId ?? getFocusId(params.db);
  const filters = parseOptionalFilters(params.options.status);
  const flat = parseOptionalBoolean(params.options.flat);
  const showDescriptions = parseOptionalBoolean(params.options.desc);
  const level = parseOptionalInteger(params.options.level);

  const parsedFilters = filters?.map((filter) =>
    ListStatusFilterSchema.safeParse(filter),
  );

  if (parsedFilters?.some((filter) => !filter.success)) {
    return {
      type: 'error',
      message: `Usage: ${getListUsage(params.prefix, params.alias)}`,
    };
  }

  if (level !== null && level < 0) {
    return {
      type: 'error',
      message: `Usage: ${getListUsage(params.prefix, params.alias)}`,
    };
  }

  if (rootId !== null && !getTodo(params.db, rootId)) {
    return {
      type: 'error',
      message: `Todo not found: #${rootId}`,
    };
  }

  const scope =
    rootId === null
      ? null
      : {
          rootId,
          rootTitle: getTodo(params.db, rootId)!.todo,
        };

  let todos =
    rootId === null
      ? listTodos(params.db)
      : listTodosInSubtree(params.db, rootId);

  const statusFilters = parsedFilters?.map((filter) => filter.data) as
    | ListStatusFilter[]
    | undefined;

  if (!statusFilters) {
    todos = todos.filter(isActiveListTodo);
  } else if (!statusFilters.includes('all')) {
    const allowedStatuses = new Set(statusFilters);
    todos = filterTodosWithTreeContext(todos, allowedStatuses);
  }

  if (level !== null) {
    todos = todos.filter(
      (todo) => relativeDepth(params.db, todo, rootId) === level,
    );
  }

  if (todos.length === 0) {
    return {
      type: 'empty',
      scope,
      view: flat || level !== null ? 'flat' : 'tree',
      showDescriptions,
      message: 'No todos matching filter.',
    };
  }

  return {
    type: 'success',
    scope,
    view: flat || level !== null ? 'flat' : 'tree',
    showDescriptions,
    items: todos.map((todo: TodoWithWinStats) => ({
      id: todo.id,
      parentId:
        rootId !== null && todo.id === rootId ? null : (todo.parent_id ?? null),
      text: todo.todo,
      status: todo.status,
      description: todo.description,
      depth:
        rootId !== null && todo.id === rootId
          ? 0
          : relativeDepth(params.db, todo, rootId),
      wins: todo.wins ?? 0,
      losses: todo.losses ?? 0,
      winRate: todo.win_rate ?? null,
    })),
  };
}

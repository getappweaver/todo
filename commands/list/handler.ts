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

function parseOptionalFilter(value: unknown): string | null {
  return typeof value === 'string' ? value.toLowerCase() : null;
}

function getListUsage(prefix: string, alias: string): string {
  return `${prefix}${alias} list [<id>] [--status ${formatListStatusFilterChoices()}] [--flat] [--desc] [--level <n>]`;
}

export type ListCommandResult =
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'empty';
      scope: { rootId: number; rootTitle: string } | null;
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
  const filter = parseOptionalFilter(params.options.status);
  const flat = parseOptionalBoolean(params.options.flat);
  const showDescriptions = parseOptionalBoolean(params.options.desc);
  const level = parseOptionalInteger(params.options.level);

  const parsedFilter =
    filter === null ? null : ListStatusFilterSchema.safeParse(filter);

  if (parsedFilter && !parsedFilter.success) {
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

  if (!parsedFilter) {
    todos = todos.filter(isActiveListTodo);
  } else if (parsedFilter.data !== 'all') {
    todos = todos.filter((todo) => todo.status === parsedFilter.data);
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

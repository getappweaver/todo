import type { Database } from 'bun:sqlite';

import type { Todo, TodoWithWinStats } from '../../types/todos';

import {
  findNextChampionScope,
  getChampionScope,
  getStaleChampionCandidate,
} from '../duel/db';

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

const TODO_PRIORITIZE_DEBUG = process.env.TODO_PRIORITIZE_DEBUG === '1';

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
  return `${prefix}${alias} list [<id>] [--status ${formatListStatusFilterChoices()}] [--flat] [--champion] [--desc] [--level <n>]`;
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

type PriorityPrompt = {
  parentId: number | null;
  parentTitle: string;
  championId: number;
  championTitle: string;
  championPath: string[];
  scopeHash: string;
};

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
      priorityPrompt: PriorityPrompt | null;
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
        isChampion: boolean;
        isPriorityWinner: boolean;
      }>;
    };

function championViewState(params: {
  db: Database;
  todos: Todo[];
  rootId: number | null;
}): { championIds: Set<number>; priorityWinnerId: number | null } {
  const championIds = new Set<number>();
  const parentIds = new Set<number | null>();

  for (const todo of params.todos) {
    parentIds.add(todo.parent_id ?? null);
  }

  if (params.rootId !== null) {
    parentIds.add(params.rootId);
  }

  for (const parentId of parentIds) {
    const scope = getChampionScope(params.db, parentId);

    if (scope.currentChampionId !== null) {
      championIds.add(scope.currentChampionId);
    }
  }

  const rootScope = getChampionScope(params.db, params.rootId);

  const rootChampion =
    rootScope.currentChampionId === null
      ? null
      : (rootScope.children.find(
          (child) => child.id === rootScope.currentChampionId,
        ) ?? null);

  const priorityWinnerId =
    rootChampion === null
      ? null
      : (rootChampion.championPath[rootChampion.championPath.length - 1]?.id ??
        rootChampion.id);

  return { championIds, priorityWinnerId };
}

function priorityPromptForRoot(params: {
  db: Database;
  rootId: number | null;
}): PriorityPrompt | null {
  const nextScope = findNextChampionScope(params.db, params.rootId);

  if (nextScope === null) {
    return null;
  }

  const stale = getStaleChampionCandidate(params.db, nextScope.parentId);

  if (stale === null || stale.scope.scopeHash !== nextScope.scopeHash) {
    return null;
  }

  const parent =
    stale.scope.parentId === null
      ? null
      : getTodo(params.db, stale.scope.parentId);

  const prompt = {
    parentId: stale.scope.parentId,
    parentTitle: parent?.todo ?? 'top-level todos',
    championId: stale.champion.id,
    championTitle: stale.champion.todo,
    championPath: stale.champion.championPath.map((item) => item.todo),
    scopeHash: stale.scope.scopeHash,
  };

  if (TODO_PRIORITIZE_DEBUG) {
    console.log(
      '[todo:prioritize] list-stale-prompt',
      JSON.stringify({
        parentId: prompt.parentId,
        parentTitle: prompt.parentTitle,
        championId: prompt.championId,
        oldScopeHash: stale.stored.scopeHash,
        newScopeHash: stale.scope.scopeHash,
      }),
    );
  }

  return prompt;
}

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
  const championOnly = parseOptionalBoolean(params.options.champion);
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
    ListStatusFilter[] | undefined;

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

  const champions = championViewState({
    db: params.db,
    todos,
    rootId,
  });

  if (championOnly) {
    todos = todos.filter(
      (todo) =>
        champions.championIds.has(todo.id) ||
        champions.priorityWinnerId === todo.id,
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

  const priorityPrompt = priorityPromptForRoot({ db: params.db, rootId });

  return {
    type: 'success',
    scope,
    view: flat || level !== null ? 'flat' : 'tree',
    showDescriptions,
    priorityPrompt,
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
      isChampion: champions.championIds.has(todo.id),
      isPriorityWinner: champions.priorityWinnerId === todo.id,
    })),
  };
}

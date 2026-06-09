import type { Database } from 'bun:sqlite';

import { debug } from '@src/logger';
import type { WebAction, WebNode, WebNodeRoot } from '@src/web/ui-schema';

import { getTodo } from '../../db/todos';
import type { Todo } from '../../types/todos';

import { handleListCommand } from '../list/handler';
import { renderListWeb } from '../list/renderers/web';
import { createListRepresentation } from '../list/representation/builder';

import {
  renderChampionQuestion,
  renderDuelQuestion,
  renderDuelShell,
  type ChampionContext,
  type DuelButton,
  type DuelTodoItem,
} from './component';
import {
  clearChampionScopeSkips,
  findNextChampionScope,
  getChampionScope,
  getNextTournamentPairForScope,
  getRankedSiblings,
  getResolvedChampionChildren,
  getStaleChampionCandidate,
  keepChampion,
  recordComparisonWithPrecedence,
  resetChampionScope,
  setChampion,
  skipComparison,
  skipChampionScope,
  countSkippedComparisonsInScope,
  wouldContradict,
} from './db';
import type { ChampionScope, ChampionTodo, RankedTodo } from './representation';

type HandleDuelWebActionProps = {
  db: Database;
  commandAlias: string;
  parentId: number | null;
  actionArgs: string[];
};

type RenderDuelScopeProps = {
  db: Database;
  commandAlias: string;
  parentId: number | null;
  returnRootId: number | null;
  notice: string | null;
};

type RenderRefreshChampionPickProps = RenderDuelScopeProps & {
  flowRootId: number | null;
};

type DuelWebActionProps = {
  commandAlias: string;
  parentId: number | null;
  returnRootId: number | null;
  actionArgs: string[];
};

function text(value: string): WebNode {
  return { type: 'text', value };
}

function debugPrioritize(event: string, data: Record<string, unknown>): void {
  debug(`[todo:prioritize] ${event}`, JSON.stringify(data));
}

function describeScope(scope: ChampionScope | null): Record<string, unknown> {
  if (scope === null) {
    return { scope: null };
  }

  return {
    parentId: scope.parentId,
    scopeHash: scope.scopeHash,
    currentChampionId: scope.currentChampionId,
    childIds: scope.children.map((child) => child.id),
    childLabels: scope.children.map((child) => child.todo),
  };
}

function duelWebAction(props: DuelWebActionProps): WebAction {
  const args: Record<string, unknown> = {
    duelArgs: [
      'web',
      ...props.actionArgs,
      'returnRoot',
      props.returnRootId === null ? 'root' : String(props.returnRootId),
    ],
  };

  if (props.parentId !== null) {
    args.parentId = props.parentId;
  }

  return {
    type: 'command',
    command: props.commandAlias,
    subcommand: 'duel',
    arguments: args,
    options: {},
    recordInTimeline: false,
  };
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function parseReturnRootId(actionArgs: string[]): number | null {
  const markerIndex = actionArgs.indexOf('returnRoot');

  if (markerIndex < 0) {
    return null;
  }

  const raw = actionArgs[markerIndex + 1];

  return raw === 'root' ? null : parsePositiveInteger(raw);
}

function parsePrioritizeRootId(
  actionArgs: string[],
): number | null | undefined {
  const markerIndex = actionArgs.indexOf('prioritizeRoot');

  if (markerIndex < 0) {
    return undefined;
  }

  const raw = actionArgs[markerIndex + 1];

  return raw === 'root' ? null : parsePositiveInteger(raw);
}

function todoLabel(todo: { todo: string }): string {
  return todo.todo;
}

function todoPathToRoot(db: Database, todoId: number): string[] {
  const path: string[] = [];
  let currentId: number | null = todoId;

  while (currentId !== null) {
    const todo = getTodo(db, currentId);

    if (!todo) {
      break;
    }

    path.unshift(todoLabel(todo));
    currentId = todo.parent_id ?? null;
  }

  return path;
}

function todoIdPathToRoot(db: Database, todoId: number): number[] {
  const path: number[] = [];
  let currentId: number | null = todoId;

  while (currentId !== null) {
    const todo = getTodo(db, currentId);

    if (!todo) {
      break;
    }

    path.unshift(todo.id);
    currentId = todo.parent_id ?? null;
  }

  return path;
}

function championContext(props: {
  db: Database;
  scope: ChampionScope;
  rootId: number | null;
}): ChampionContext {
  const rootItems = getRankedSiblings(props.db, props.rootId).map((sibling) =>
    toDuelTodoItem(props.db, sibling),
  );

  if (props.scope.parentId === props.rootId) {
    return {
      parentPath:
        props.scope.parentId === null
          ? []
          : todoPathToRoot(props.db, props.scope.parentId),
      currentParentId: null,
      rootItems,
      defaultExpandedIds: [],
    };
  }

  const parentPath =
    props.scope.parentId === null
      ? []
      : todoPathToRoot(props.db, props.scope.parentId);

  const expandedPath =
    props.scope.parentId === null
      ? []
      : todoIdPathToRoot(props.db, props.scope.parentId);

  return {
    parentPath,
    currentParentId: props.scope.parentId,
    rootItems,
    defaultExpandedIds: expandedPath.filter(
      (id) => props.rootId === null || id !== props.rootId,
    ),
  };
}

function countDirectComparisonsInScope(
  db: Database,
  siblings: RankedTodo[],
): number {
  if (siblings.length < 2) {
    return 0;
  }

  const ids = siblings.map((todo) => todo.id);
  const placeholders = ids.map(() => '?').join(',');

  const row = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM todo_comparisons
       WHERE winner_id IN (${placeholders})
         AND loser_id IN (${placeholders})`,
    )
    .get(...ids, ...ids) as { c: number } | undefined;

  return Number(row?.c ?? 0);
}

function renderList(props: {
  db: Database;
  commandAlias: string;
  rootId: number | null;
}): WebNodeRoot {
  const listArguments = props.rootId === null ? {} : { rootId: props.rootId };

  const result = handleListCommand({
    prefix: '/',
    alias: props.commandAlias,
    db: props.db,
    arguments: listArguments,
    options: {},
  });

  if (result.type === 'error') {
    return renderMessage({
      commandAlias: props.commandAlias,
      parentId: props.rootId,
      title: 'Todo List',
      message: result.message,
    });
  }

  return renderListWeb(
    createListRepresentation({
      command: props.commandAlias,
      subcommand: 'list',
      scope: result.scope,
      view: result.view,
      showDescriptions: result.showDescriptions,
      listInvocation: {
        arguments: listArguments,
        options: {},
      },
      priorityPrompt: result.type === 'empty' ? null : result.priorityPrompt,
      items: result.type === 'empty' ? [] : result.items,
    }),
    { prefix: '/' },
  );
}

function scopeTitle(db: Database, parentId: number | null): string {
  if (parentId === null) {
    return 'Top-level todos';
  }

  const todo = getTodo(db, parentId);

  return todo ? `Children of ${todoLabel(todo)}` : `Children of #${parentId}`;
}

function renderMessage(props: {
  commandAlias: string;
  parentId: number | null;
  title: string;
  message: string;
}): WebNodeRoot {
  return renderDuelShell({
    commandAlias: props.commandAlias,
    parentId: props.parentId,
    title: props.title,
    children: [
      {
        type: 'element',
        tag: 'text',
        children: [text(props.message)],
      },
    ],
  });
}

function toDuelTodoItem(db: Database, item: RankedTodo): DuelTodoItem {
  return toDuelTodoItemFromTodo(db, item);
}

function toDuelTodoItemFromTodo(db: Database, item: Todo): DuelTodoItem {
  const childScope = getChampionScope(db, item.id);
  const championId = childScope.currentChampionId;

  return {
    id: item.id,
    todo: todoLabel(item),
    status: item.status,
    hasChampion: championId !== null,
    selectedChampion: false,
    children: getRankedSiblings(db, item.id).map((child) =>
      markSelectedChampion(toDuelTodoItem(db, child), championId),
    ),
  };
}

function formatRepresentativePath(path: RankedTodo[]): string {
  return path
    .map((pathItem, index) =>
      index === 0
        ? todoLabel(pathItem)
        : `${'  '.repeat(index)}→ ${todoLabel(pathItem)}`,
    )
    .join('\n');
}

function toChampionRepresentativeItem(item: ChampionTodo): DuelTodoItem {
  const representative = item.championLeaf;

  return {
    id: item.id,
    todo: formatRepresentativePath(item.championPath),
    status: representative.status,
    hasChampion: item.championPath.length > 1,
    selectedChampion: false,
    children: [],
  };
}

function markSelectedChampion(
  item: DuelTodoItem,
  championId: number | null,
): DuelTodoItem {
  return item.id === championId ? { ...item, selectedChampion: true } : item;
}

function duelButton(params: {
  label: string;
  action: WebAction;
  className: string | null;
  storyTargetId: string | null;
}): DuelButton {
  return params;
}

function renderPrioritizeComplete(props: RenderDuelScopeProps): WebNodeRoot {
  debugPrioritize('complete:return-list', {
    parentId: props.parentId,
    returnRootId: props.returnRootId,
    notice: props.notice,
  });

  return renderList({
    db: props.db,
    commandAlias: props.commandAlias,
    rootId: props.returnRootId,
  });
}

function renderPrioritizeScope(props: RenderDuelScopeProps): WebNodeRoot {
  const scope = findNextChampionScope(props.db, props.parentId);

  debugPrioritize('render-scope', {
    parentId: props.parentId,
    returnRootId: props.returnRootId,
    notice: props.notice,
    nextScope: describeScope(scope),
  });

  if (scope === null) {
    return renderPrioritizeComplete(props);
  }

  return renderChampionScope({ ...props, scope });
}

function renderPrioritizeFromButton(props: RenderDuelScopeProps): WebNodeRoot {
  if (props.parentId !== null) {
    return renderRefreshChampionPick({ ...props, flowRootId: props.parentId });
  }

  const stale = getStaleChampionCandidate(props.db, props.parentId);

  if (stale !== null) {
    clearChampionScopeSkips({
      db: props.db,
      parentId: stale.scope.parentId,
      scopeHash: stale.scope.scopeHash,
    });

    debugPrioritize('stale-root-button:auto-duel', {
      rootId: props.parentId,
      returnRootId: props.returnRootId,
      scope: describeScope(stale.scope),
      storedChampionId: stale.stored.championId,
      storedScopeHash: stale.stored.scopeHash,
    });

    return renderChampionRepresentativeDuel({ ...props, scope: stale.scope });
  }

  return renderPrioritizeScope(props);
}

function renderRefreshChampionPick(
  props: RenderRefreshChampionPickProps,
): WebNodeRoot {
  const scope = getChampionScope(props.db, props.parentId);

  debugPrioritize('refresh-pick', {
    parentId: props.parentId,
    returnRootId: props.returnRootId,
    scope: describeScope(scope),
  });

  if (scope.children.length < 2) {
    return renderMessage({
      commandAlias: props.commandAlias,
      parentId: props.parentId,
      title: scopeTitle(props.db, props.parentId),
      message: 'Need at least 2 active children to prioritize here.',
    });
  }

  return renderChampionQuestion({
    commandAlias: props.commandAlias,
    parentId: props.parentId,
    title: scopeTitle(props.db, props.parentId),
    notice: props.notice,
    context: championContext({
      db: props.db,
      scope,
      rootId: props.parentId,
    }),
    choices: scope.children.map((item) => ({
      item: markSelectedChampion(
        toDuelTodoItem(props.db, item),
        scope.currentChampionId,
      ),
      label: 'Pick',
      storyTargetId: null,
      action: duelWebAction({
        commandAlias: props.commandAlias,
        parentId: props.parentId,
        returnRootId: props.returnRootId,
        actionArgs: [
          'prioritizeRefreshPick',
          String(item.id),
          scope.scopeHash,
          'prioritizeRoot',
          props.flowRootId === null ? 'root' : String(props.flowRootId),
        ],
      }),
    })),
    actions: [
      duelButton({
        label: 'Quit',
        className: null,
        storyTargetId: null,
        action: duelWebAction({
          commandAlias: props.commandAlias,
          parentId: props.parentId,
          returnRootId: props.returnRootId,
          actionArgs: ['quit'],
        }),
      }),
    ],
  });
}

function renderChampionRepresentativeDuel(
  props: RenderDuelScopeProps & { scope: ChampionScope },
): WebNodeRoot {
  const representativeChildren = getResolvedChampionChildren(
    props.db,
    props.scope,
  );

  const pair = getNextTournamentPairForScope({
    db: props.db,
    parentId: props.scope.parentId,
    skipScopeHash: props.scope.scopeHash,
    ranked: representativeChildren,
  });

  debugPrioritize('representative-duel', {
    rootId: props.parentId,
    scope: describeScope(props.scope),
    representativeScope: describeScope({
      ...props.scope,
      children: representativeChildren,
    }),
    pair,
  });

  if (!pair) {
    const top = representativeChildren[0];

    if (top) {
      setChampion({
        db: props.db,
        parentId: props.scope.parentId,
        scopeHash: props.scope.scopeHash,
        championId: top.id,
        source: 'prioritize',
      });

      debugPrioritize('representative-duel:set-scope-champion', {
        parentId: props.scope.parentId,
        scopeHash: props.scope.scopeHash,
        championId: top.id,
      });
    }

    return renderPrioritizeScope(props);
  }

  const byId = new Map(representativeChildren.map((item) => [item.id, item]));
  const itemA = byId.get(pair.aId);
  const itemB = byId.get(pair.bId);

  if (!itemA || !itemB) {
    return renderPrioritizeScope({
      ...props,
      notice:
        'This priority duel changed. Recalculated the next needed choice.',
    });
  }

  const remaining = representativeChildren.filter(
    (item) => item.id !== itemA.id && item.id !== itemB.id,
  );

  const totalQuestions = Math.max(representativeChildren.length - 1, 1);

  const completedQuestions = countDirectComparisonsInScope(
    props.db,
    representativeChildren,
  );

  const skippedQuestions = countSkippedComparisonsInScope({
    db: props.db,
    ranked: representativeChildren,
    scopeHash: props.scope.scopeHash,
  });

  const currentQuestion = Math.min(
    completedQuestions + skippedQuestions + 1,
    totalQuestions,
  );

  return renderDuelQuestion({
    commandAlias: props.commandAlias,
    parentId: props.scope.parentId,
    title: scopeTitle(props.db, props.scope.parentId),
    notice: props.notice,
    question: `Champion tournament ${currentQuestion} of ~${totalQuestions}: which should you do first?`,
    a: {
      label: 'A',
      item: toChampionRepresentativeItem(itemA),
      storyTargetId: null,
      action: duelWebAction({
        commandAlias: props.commandAlias,
        parentId: props.scope.parentId,
        returnRootId: props.returnRootId,
        actionArgs: [
          'prioritizeAnswer',
          String(itemA.id),
          String(itemB.id),
          props.scope.scopeHash,
          'prioritizeRoot',
          props.parentId === null ? 'root' : String(props.parentId),
        ],
      }),
    },
    b: {
      label: 'B',
      item: toChampionRepresentativeItem(itemB),
      storyTargetId: null,
      action: duelWebAction({
        commandAlias: props.commandAlias,
        parentId: props.scope.parentId,
        returnRootId: props.returnRootId,
        actionArgs: [
          'prioritizeAnswer',
          String(itemB.id),
          String(itemA.id),
          props.scope.scopeHash,
          'prioritizeRoot',
          props.parentId === null ? 'root' : String(props.parentId),
        ],
      }),
    },
    actions: [
      duelButton({
        label: 'Skip',
        className: null,
        storyTargetId: null,
        action: duelWebAction({
          commandAlias: props.commandAlias,
          parentId: props.scope.parentId,
          returnRootId: props.returnRootId,
          actionArgs: [
            'prioritizeDuelSkip',
            String(itemA.id),
            String(itemB.id),
            props.scope.scopeHash,
            'prioritizeRoot',
            props.parentId === null ? 'root' : String(props.parentId),
          ],
        }),
      }),
      duelButton({
        label: 'Quit',
        className: null,
        storyTargetId: null,
        action: duelWebAction({
          commandAlias: props.commandAlias,
          parentId: props.parentId,
          returnRootId: props.returnRootId,
          actionArgs: ['quit'],
        }),
      }),
    ],
    remaining: remaining.map(toChampionRepresentativeItem),
  });
}

function renderChampionScope(
  props: RenderDuelScopeProps & { scope: ChampionScope },
): WebNodeRoot {
  const stale = getStaleChampionCandidate(props.db, props.scope.parentId);

  if (stale !== null && props.scope.parentId === props.parentId) {
    debugPrioritize('stale-top-scope:auto-duel', {
      rootId: props.parentId,
      returnRootId: props.returnRootId,
      scope: describeScope(props.scope),
      storedChampionId: stale.stored.championId,
      storedScopeHash: stale.stored.scopeHash,
    });

    return renderChampionRepresentativeDuel(props);
  }

  if (stale !== null && stale.scope.scopeHash === props.scope.scopeHash) {
    debugPrioritize('stale-prompt', {
      rootId: props.parentId,
      returnRootId: props.returnRootId,
      scope: describeScope(props.scope),
      storedChampionId: stale.stored.championId,
      storedScopeHash: stale.stored.scopeHash,
    });

    return renderChampionQuestion({
      commandAlias: props.commandAlias,
      parentId: props.scope.parentId,
      title: scopeTitle(props.db, props.scope.parentId),
      notice:
        props.notice ??
        'This branch changed. Keep the highlighted champion or choose another item.',
      context: championContext({
        db: props.db,
        scope: props.scope,
        rootId: props.parentId,
      }),
      choices: props.scope.children.map((item) => {
        const isStaleChampion = item.id === stale.champion.id;

        return {
          item: markSelectedChampion(
            toDuelTodoItem(props.db, item),
            stale.champion.id,
          ),
          label: isStaleChampion ? 'Keep' : 'Pick',
          storyTargetId: null,
          action: duelWebAction({
            commandAlias: props.commandAlias,
            parentId: props.scope.parentId,
            returnRootId: props.returnRootId,
            actionArgs: isStaleChampion
              ? [
                  'prioritizeKeepChampion',
                  String(stale.champion.id),
                  props.scope.scopeHash,
                  'prioritizeRoot',
                  props.parentId === null ? 'root' : String(props.parentId),
                ]
              : [
                  'prioritizePick',
                  String(item.id),
                  props.scope.scopeHash,
                  'prioritizeRoot',
                  props.parentId === null ? 'root' : String(props.parentId),
                ],
          }),
        };
      }),
      actions: [
        duelButton({
          label: 'Keep highlighted',
          className: 'todo-duel-pick-button todo-champion-pick-row',
          storyTargetId: null,
          action: duelWebAction({
            commandAlias: props.commandAlias,
            parentId: props.scope.parentId,
            returnRootId: props.returnRootId,
            actionArgs: [
              'prioritizeKeepChampion',
              String(stale.champion.id),
              props.scope.scopeHash,
              'prioritizeRoot',
              props.parentId === null ? 'root' : String(props.parentId),
            ],
          }),
        }),
        duelButton({
          label: 'Skip',
          className: null,
          storyTargetId: null,
          action: duelWebAction({
            commandAlias: props.commandAlias,
            parentId: props.scope.parentId,
            returnRootId: props.returnRootId,
            actionArgs: [
              'prioritizeSkip',
              props.scope.scopeHash,
              'prioritizeRoot',
              props.parentId === null ? 'root' : String(props.parentId),
            ],
          }),
        }),
        duelButton({
          label: 'Quit',
          className: null,
          storyTargetId: null,
          action: duelWebAction({
            commandAlias: props.commandAlias,
            parentId: props.parentId,
            returnRootId: props.returnRootId,
            actionArgs: ['quit'],
          }),
        }),
      ],
    });
  }

  if (props.scope.parentId === props.parentId) {
    return renderChampionRepresentativeDuel(props);
  }

  return renderChampionQuestion({
    commandAlias: props.commandAlias,
    parentId: props.scope.parentId,
    title: scopeTitle(props.db, props.scope.parentId),
    notice: props.notice,
    context: championContext({
      db: props.db,
      scope: props.scope,
      rootId: props.parentId,
    }),
    choices: props.scope.children.map((item) => ({
      item: toDuelTodoItem(props.db, item),
      label: 'Pick',
      storyTargetId: null,
      action: duelWebAction({
        commandAlias: props.commandAlias,
        parentId: props.scope.parentId,
        returnRootId: props.returnRootId,
        actionArgs: [
          'prioritizePick',
          String(item.id),
          props.scope.scopeHash,
          'prioritizeRoot',
          props.parentId === null ? 'root' : String(props.parentId),
        ],
      }),
    })),
    actions: [
      duelButton({
        label: 'Skip',
        className: null,
        storyTargetId: null,
        action: duelWebAction({
          commandAlias: props.commandAlias,
          parentId: props.scope.parentId,
          returnRootId: props.returnRootId,
          actionArgs: [
            'prioritizeSkip',
            props.scope.scopeHash,
            'prioritizeRoot',
            props.parentId === null ? 'root' : String(props.parentId),
          ],
        }),
      }),
      duelButton({
        label: 'Quit',
        className: null,
        storyTargetId: null,
        action: duelWebAction({
          commandAlias: props.commandAlias,
          parentId: props.parentId,
          returnRootId: props.returnRootId,
          actionArgs: ['quit'],
        }),
      }),
    ],
  });
}

export function handleDuelWebAction(
  props: HandleDuelWebActionProps,
): WebNodeRoot {
  const action = props.actionArgs[0] ?? 'prioritize';
  const returnRootId = parseReturnRootId(props.actionArgs);
  const prioritizeRootId = parsePrioritizeRootId(props.actionArgs);

  if (action.startsWith('prioritize')) {
    debugPrioritize('action', {
      action,
      parentId: props.parentId,
      returnRootId,
      prioritizeRootId,
      actionArgs: props.actionArgs,
    });
  }

  if (action === 'prioritize') {
    return renderPrioritizeFromButton({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: props.parentId,
      returnRootId,
      notice: null,
    });
  }

  if (action === 'prioritizeFlow') {
    return renderPrioritizeScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: props.parentId,
      returnRootId,
      notice: null,
    });
  }

  if (action === 'prioritizePick') {
    const championId = parsePositiveInteger(props.actionArgs[1]);
    const scopeHash = props.actionArgs[2];

    const flowRootId =
      prioritizeRootId === undefined ? props.parentId : prioritizeRootId;

    const scope = findNextChampionScope(props.db, flowRootId);

    debugPrioritize('pick:before-validation', {
      championId,
      scopeHash,
      flowRootId,
      scope: describeScope(scope),
    });

    if (
      championId === null ||
      !scope ||
      scope.scopeHash !== scopeHash ||
      !scope.children.some((child) => child.id === championId)
    ) {
      debugPrioritize('pick:invalid', {
        championId,
        scopeHash,
        flowRootId,
        scope: describeScope(scope),
      });

      return renderPrioritizeScope({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: flowRootId,
        returnRootId,
        notice:
          'This priority question changed. Recalculated the next needed choice.',
      });
    }

    setChampion({
      db: props.db,
      parentId: scope.parentId,
      scopeHash: scope.scopeHash,
      championId,
      source: 'prioritize',
    });

    debugPrioritize('pick:set-champion', {
      championId,
      flowRootId,
      parentId: scope.parentId,
      scopeHash: scope.scopeHash,
      nextScope: describeScope(findNextChampionScope(props.db, flowRootId)),
    });

    return renderPrioritizeScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: flowRootId,
      returnRootId,
      notice: null,
    });
  }

  if (action === 'prioritizeRefreshPick') {
    const championId = parsePositiveInteger(props.actionArgs[1]);
    const scopeHash = props.actionArgs[2];

    const flowRootId =
      prioritizeRootId === undefined ? props.parentId : prioritizeRootId;

    const scope = getChampionScope(props.db, props.parentId);

    debugPrioritize('refresh-pick:before-validation', {
      championId,
      scopeHash,
      flowRootId,
      scope: describeScope(scope),
    });

    if (
      championId === null ||
      scope.scopeHash !== scopeHash ||
      !scope.children.some((child) => child.id === championId)
    ) {
      debugPrioritize('refresh-pick:invalid', {
        championId,
        scopeHash,
        flowRootId,
        scope: describeScope(scope),
      });

      return renderRefreshChampionPick({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: props.parentId,
        flowRootId,
        returnRootId,
        notice:
          'This priority question changed. Recalculated the current choices.',
      });
    }

    resetChampionScope(props.db, scope.parentId);

    setChampion({
      db: props.db,
      parentId: scope.parentId,
      scopeHash: scope.scopeHash,
      championId,
      source: 'prioritize',
    });

    debugPrioritize('refresh-pick:set-champion', {
      championId,
      flowRootId,
      parentId: scope.parentId,
      scopeHash: scope.scopeHash,
      nextScope: describeScope(findNextChampionScope(props.db, flowRootId)),
    });

    return renderPrioritizeScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: flowRootId,
      returnRootId,
      notice: null,
    });
  }

  if (action === 'prioritizeKeepChampion') {
    const championId = parsePositiveInteger(props.actionArgs[1]);
    const scopeHash = props.actionArgs[2];

    const flowRootId =
      prioritizeRootId === undefined ? props.parentId : prioritizeRootId;

    const stale = getStaleChampionCandidate(props.db, props.parentId);

    debugPrioritize('keep:before-validation', {
      championId,
      scopeHash,
      flowRootId,
      staleScope: stale === null ? null : describeScope(stale.scope),
      storedChampionId: stale?.stored.championId ?? null,
    });

    if (
      championId === null ||
      stale === null ||
      stale.scope.scopeHash !== scopeHash ||
      stale.champion.id !== championId
    ) {
      debugPrioritize('keep:invalid', {
        championId,
        scopeHash,
        flowRootId,
        staleScope: stale === null ? null : describeScope(stale.scope),
      });

      return renderPrioritizeScope({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: flowRootId,
        returnRootId,
        notice:
          'This priority question changed. Recalculated the next needed choice.',
      });
    }

    keepChampion({
      db: props.db,
      parentId: stale.scope.parentId,
      scopeHash: stale.scope.scopeHash,
      championId,
      source: 'prioritize',
    });

    debugPrioritize('keep:set-same-champion', {
      championId,
      flowRootId,
      parentId: stale.scope.parentId,
      oldScopeHash: stale.stored.scopeHash,
      newScopeHash: stale.scope.scopeHash,
      preservedParentComparisons: true,
      nextScope: describeScope(findNextChampionScope(props.db, flowRootId)),
    });

    return renderPrioritizeScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: flowRootId,
      returnRootId,
      notice: null,
    });
  }

  if (action === 'prioritizePickNew') {
    const scopeHash = props.actionArgs[1];

    const flowRootId =
      prioritizeRootId === undefined ? props.parentId : prioritizeRootId;

    const stale = getStaleChampionCandidate(props.db, props.parentId);

    debugPrioritize('pick-new:before-validation', {
      scopeHash,
      flowRootId,
      staleScope: stale === null ? null : describeScope(stale.scope),
      storedChampionId: stale?.stored.championId ?? null,
    });

    if (stale === null || stale.scope.scopeHash !== scopeHash) {
      debugPrioritize('pick-new:invalid', {
        scopeHash,
        flowRootId,
        staleScope: stale === null ? null : describeScope(stale.scope),
      });

      return renderPrioritizeScope({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: flowRootId,
        returnRootId,
        notice:
          'This priority question changed. Recalculated the next needed choice.',
      });
    }

    if (props.parentId !== null) {
      debugPrioritize('pick-new:show-pick', {
        parentId: props.parentId,
        flowRootId,
        scope: describeScope(stale.scope),
      });

      return renderRefreshChampionPick({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: props.parentId,
        flowRootId,
        returnRootId,
        notice: null,
      });
    }

    resetChampionScope(props.db, props.parentId);

    debugPrioritize('pick-new:reset-for-tournament', {
      parentId: props.parentId,
      flowRootId,
      scopeHash,
    });

    return renderPrioritizeScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: flowRootId,
      returnRootId,
      notice: null,
    });
  }

  if (action === 'prioritizeAnswer') {
    const winnerId = parsePositiveInteger(props.actionArgs[1]);
    const loserId = parsePositiveInteger(props.actionArgs[2]);
    const scopeHash = props.actionArgs[3];

    const flowRootId =
      prioritizeRootId === undefined ? props.parentId : prioritizeRootId;

    const scope = findNextChampionScope(props.db, flowRootId);

    debugPrioritize('answer:before-validation', {
      winnerId,
      loserId,
      scopeHash,
      flowRootId,
      scope: describeScope(scope),
    });

    if (
      winnerId === null ||
      loserId === null ||
      !scope ||
      scope.parentId !== flowRootId ||
      scope.scopeHash !== scopeHash ||
      !scope.children.some((child) => child.id === winnerId) ||
      !scope.children.some((child) => child.id === loserId)
    ) {
      debugPrioritize('answer:invalid', {
        winnerId,
        loserId,
        scopeHash,
        flowRootId,
        scope: describeScope(scope),
      });

      return renderPrioritizeScope({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: flowRootId,
        returnRootId,
        notice:
          'This priority duel changed. Recalculated the next needed choice.',
      });
    }

    if (wouldContradict(props.db, loserId, winnerId)) {
      debugPrioritize('answer:contradiction', {
        winnerId,
        loserId,
        flowRootId,
      });

      recordComparisonWithPrecedence({
        db: props.db,
        winnerId,
        loserId,
      });

      return renderPrioritizeScope({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: flowRootId,
        returnRootId,
        notice: 'Updated earlier priority results to keep that choice.',
      });
    }

    recordComparisonWithPrecedence({
      db: props.db,
      winnerId,
      loserId,
    });

    debugPrioritize('answer:recorded', {
      winnerId,
      loserId,
      flowRootId,
      nextScope: describeScope(findNextChampionScope(props.db, flowRootId)),
    });

    return renderPrioritizeScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: flowRootId,
      returnRootId,
      notice: null,
    });
  }

  if (action === 'prioritizeDuelSkip') {
    const aId = parsePositiveInteger(props.actionArgs[1]);
    const bId = parsePositiveInteger(props.actionArgs[2]);
    const scopeHash = props.actionArgs[3];

    const flowRootId =
      prioritizeRootId === undefined ? props.parentId : prioritizeRootId;

    const scope = findNextChampionScope(props.db, flowRootId);

    debugPrioritize('duel-skip:before-validation', {
      aId,
      bId,
      scopeHash,
      flowRootId,
      scope: describeScope(scope),
    });

    if (
      aId === null ||
      bId === null ||
      !scope ||
      scope.parentId !== flowRootId ||
      scope.scopeHash !== scopeHash ||
      !scope.children.some((child) => child.id === aId) ||
      !scope.children.some((child) => child.id === bId)
    ) {
      debugPrioritize('duel-skip:invalid', {
        aId,
        bId,
        scopeHash,
        flowRootId,
        scope: describeScope(scope),
      });

      return renderPrioritizeScope({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: flowRootId,
        returnRootId,
        notice:
          'This priority duel changed. Recalculated the next needed choice.',
      });
    }

    skipComparison({
      db: props.db,
      scopeHash: scope.scopeHash,
      aId,
      bId,
    });

    debugPrioritize('duel-skip:recorded', {
      aId,
      bId,
      flowRootId,
      scopeHash: scope.scopeHash,
      nextScope: describeScope(findNextChampionScope(props.db, flowRootId)),
    });

    return renderPrioritizeScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: flowRootId,
      returnRootId,
      notice: 'Skipped this duel for now.',
    });
  }

  if (action === 'prioritizeSkip') {
    const scopeHash = props.actionArgs[1];

    const flowRootId =
      prioritizeRootId === undefined ? props.parentId : prioritizeRootId;

    const scope = findNextChampionScope(props.db, flowRootId);

    debugPrioritize('skip:before-validation', {
      scopeHash,
      flowRootId,
      scope: describeScope(scope),
    });

    if (!scope || scope.scopeHash !== scopeHash) {
      debugPrioritize('skip:invalid', {
        scopeHash,
        flowRootId,
        scope: describeScope(scope),
      });

      return renderPrioritizeScope({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: flowRootId,
        returnRootId,
        notice:
          'This priority question changed. Recalculated the next needed choice.',
      });
    }

    skipChampionScope({
      db: props.db,
      parentId: scope.parentId,
      scopeHash: scope.scopeHash,
    });

    debugPrioritize('skip:set-skip', {
      flowRootId,
      parentId: scope.parentId,
      scopeHash: scope.scopeHash,
      nextScope: describeScope(findNextChampionScope(props.db, flowRootId)),
    });

    return renderPrioritizeScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: flowRootId,
      returnRootId,
      notice: 'Skipped this branch for now.',
    });
  }

  if (action === 'setChampion') {
    const championId = parsePositiveInteger(props.actionArgs[1]);
    const scope = getChampionScope(props.db, props.parentId);

    if (
      championId === null ||
      !scope.children.some((child) => child.id === championId)
    ) {
      return renderPrioritizeScope({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: returnRootId,
        returnRootId: returnRootId,
        notice: 'That item is no longer active in this branch.',
      });
    }

    setChampion({
      db: props.db,
      parentId: props.parentId,
      scopeHash: scope.scopeHash,
      championId,
      source: 'manual',
    });

    return renderPrioritizeScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: returnRootId,
      returnRootId: returnRootId,
      notice: 'Manual champion set. Continuing priority recalculation.',
    });
  }

  if (action === 'quit') {
    return renderList({
      db: props.db,
      commandAlias: props.commandAlias,
      rootId: returnRootId,
    });
  }

  return renderPrioritizeFromButton({
    db: props.db,
    commandAlias: props.commandAlias,
    parentId: props.parentId,
    returnRootId,
    notice: null,
  });
}

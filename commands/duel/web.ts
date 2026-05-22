import type { Database } from 'bun:sqlite';

import type { WebAction, WebNode, WebNodeRoot } from '@src/web/ui-schema';

import { getTodo } from '../../db/todos';

import { handleListCommand } from '../list/handler';
import { renderListWeb } from '../list/renderers/web';
import { createListRepresentation } from '../list/representation/builder';

import {
  renderDuelComplete as renderDuelCompleteComponent,
  renderDuelQuestion,
  renderDuelShell,
  renderDuelScopeChoice,
  type DuelButton,
  type DuelTodoItem,
} from './component';
import {
  countActiveSiblings,
  getNextPair,
  getRankedSiblings,
  recordComparison,
  resetComparisons,
  wouldContradict,
} from './db';
import type { RankedTodo } from './representation';

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

type DuelWebActionProps = {
  commandAlias: string;
  parentId: number | null;
  returnRootId: number | null;
  actionArgs: string[];
};

function text(value: string): WebNode {
  return { type: 'text', value };
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

function todoLabel(todo: { todo: string }): string {
  return todo.todo;
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

function renderScopeChoice(props: {
  db: Database;
  commandAlias: string;
  selectedId: number;
  returnRootId: number | null;
  childCount: number;
  siblingCount: number;
}): WebNodeRoot {
  const selected = getTodo(props.db, props.selectedId);

  return renderDuelScopeChoice({
    commandAlias: props.commandAlias,
    selectedId: props.selectedId,
    returnRootId: props.returnRootId,
    title: selected
      ? `Choose duel scope for ${todoLabel(selected)}`
      : `Choose duel scope for #${props.selectedId}`,
    childCount: props.childCount,
    siblingCount: props.siblingCount,
    childrenStoryTargetId: null,
    siblingsStoryTargetId: null,
  });
}

function toDuelTodoItem(db: Database, item: RankedTodo): DuelTodoItem {
  return {
    id: item.id,
    todo: todoLabel(item),
    children: getRankedSiblings(db, item.id).map((child) =>
      toDuelTodoItem(db, child),
    ),
  };
}

function duelButton(params: {
  label: string;
  action: WebAction;
  className: string | null;
  storyTargetId: string | null;
}): DuelButton {
  return params;
}

function renderDuelComplete(props: RenderDuelScopeProps): WebNodeRoot {
  const ranked = getRankedSiblings(props.db, props.parentId);

  return renderDuelCompleteComponent({
    commandAlias: props.commandAlias,
    parentId: props.parentId,
    title: scopeTitle(props.db, props.parentId),
    ranked: ranked.map((item) => toDuelTodoItem(props.db, item)),
    actions: [
      duelButton({
        label: 'Done',
        className: null,
        storyTargetId: null,
        action: duelWebAction({
          commandAlias: props.commandAlias,
          parentId: props.parentId,
          returnRootId: props.returnRootId,
          actionArgs: ['quit'],
        }),
      }),
      duelButton({
        label: 'Reset and re-duel',
        className: 'todo-duel-danger-button',
        storyTargetId: null,
        action: duelWebAction({
          commandAlias: props.commandAlias,
          parentId: props.parentId,
          returnRootId: props.returnRootId,
          actionArgs: ['reset'],
        }),
      }),
    ],
  });
}

function renderDuelScope(props: RenderDuelScopeProps): WebNodeRoot {
  const ranked = getRankedSiblings(props.db, props.parentId);
  const pair = getNextPair(props.db, props.parentId);

  if (ranked.length < 2) {
    return renderMessage({
      commandAlias: props.commandAlias,
      parentId: props.parentId,
      title: scopeTitle(props.db, props.parentId),
      message: 'Need at least 2 active todos at this level to duel.',
    });
  }

  if (!pair) {
    return renderDuelComplete(props);
  }

  const byId = new Map(ranked.map((item) => [item.id, item]));
  const itemA = byId.get(pair.aId);
  const itemB = byId.get(pair.bId);

  if (!itemA || !itemB) {
    return renderMessage({
      commandAlias: props.commandAlias,
      parentId: props.parentId,
      title: scopeTitle(props.db, props.parentId),
      message: 'Could not load the next duel pair.',
    });
  }

  const remaining = ranked.filter(
    (item) => item.id !== itemA.id && item.id !== itemB.id,
  );

  const totalQuestions = (ranked.length * (ranked.length - 1)) / 2;
  const completedQuestions = countDirectComparisonsInScope(props.db, ranked);
  const currentQuestion = Math.min(completedQuestions + 1, totalQuestions);

  return renderDuelQuestion({
    commandAlias: props.commandAlias,
    parentId: props.parentId,
    title: scopeTitle(props.db, props.parentId),
    notice: props.notice,
    question: `Question ${currentQuestion} of ${totalQuestions}: which is more important?`,
    a: {
      label: 'A',
      item: toDuelTodoItem(props.db, itemA),
      action: duelWebAction({
        commandAlias: props.commandAlias,
        parentId: props.parentId,
        returnRootId: props.returnRootId,
        actionArgs: ['answer', String(itemA.id), String(itemB.id)],
      }),
      storyTargetId: null,
    },
    b: {
      label: 'B',
      item: toDuelTodoItem(props.db, itemB),
      action: duelWebAction({
        commandAlias: props.commandAlias,
        parentId: props.parentId,
        returnRootId: props.returnRootId,
        actionArgs: ['answer', String(itemB.id), String(itemA.id)],
      }),
      storyTargetId: null,
    },
    actions: [
      duelButton({
        label: 'Skip',
        className: null,
        storyTargetId: null,
        action: duelWebAction({
          commandAlias: props.commandAlias,
          parentId: props.parentId,
          returnRootId: props.returnRootId,
          actionArgs: ['skip'],
        }),
      }),
      duelButton({
        label: 'Reset',
        className: null,
        storyTargetId: null,
        action: duelWebAction({
          commandAlias: props.commandAlias,
          parentId: props.parentId,
          returnRootId: props.returnRootId,
          actionArgs: ['reset'],
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
    remaining: remaining.map((item) => toDuelTodoItem(props.db, item)),
  });
}

function isActiveSiblingInScope(
  db: Database,
  parentId: number | null,
  id: number,
): boolean {
  return getRankedSiblings(db, parentId).some((item) => item.id === id);
}

function handleChoose(props: HandleDuelWebActionProps): WebNodeRoot {
  const returnRootId = parseReturnRootId(props.actionArgs);

  if (props.parentId === null) {
    return renderDuelScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: null,
      returnRootId,
      notice: null,
    });
  }

  const selected = getTodo(props.db, props.parentId);

  if (!selected) {
    return renderMessage({
      commandAlias: props.commandAlias,
      parentId: props.parentId,
      title: `Todo #${props.parentId}`,
      message: `Todo #${props.parentId} not found.`,
    });
  }

  const childCount = countActiveSiblings(props.db, props.parentId);
  const siblingParentId = selected.parent_id ?? null;
  const siblingCount = countActiveSiblings(props.db, siblingParentId);

  if (childCount >= 2 && siblingCount >= 2) {
    return renderScopeChoice({
      db: props.db,
      commandAlias: props.commandAlias,
      selectedId: props.parentId,
      returnRootId,
      childCount,
      siblingCount,
    });
  }

  if (childCount >= 2) {
    return renderDuelScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: props.parentId,
      returnRootId,
      notice: null,
    });
  }

  if (siblingCount >= 2) {
    return renderDuelScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: siblingParentId,
      returnRootId,
      notice: null,
    });
  }

  return renderMessage({
    commandAlias: props.commandAlias,
    parentId: props.parentId,
    title: todoLabel(selected),
    message:
      'Need at least 2 active todos in children or sibling scope to duel.',
  });
}

export function handleDuelWebAction(
  props: HandleDuelWebActionProps,
): WebNodeRoot {
  const action = props.actionArgs[0] ?? 'choose';
  const returnRootId = parseReturnRootId(props.actionArgs);

  if (action === 'choose') {
    return handleChoose(props);
  }

  if (action === 'start') {
    const scope = props.actionArgs[1];

    if (scope === 'children') {
      return renderDuelScope({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: props.parentId,
        returnRootId,
        notice: null,
      });
    }

    if (scope === 'siblings' && props.parentId !== null) {
      const selected = getTodo(props.db, props.parentId);

      return renderDuelScope({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: selected?.parent_id ?? null,
        returnRootId,
        notice: null,
      });
    }
  }

  if (action === 'answer') {
    const winnerId = parsePositiveInteger(props.actionArgs[1]);
    const loserId = parsePositiveInteger(props.actionArgs[2]);

    if (
      winnerId === null ||
      loserId === null ||
      !isActiveSiblingInScope(props.db, props.parentId, winnerId) ||
      !isActiveSiblingInScope(props.db, props.parentId, loserId)
    ) {
      return renderDuelScope({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: props.parentId,
        returnRootId,
        notice: 'That duel pair is no longer valid in this scope.',
      });
    }

    if (wouldContradict(props.db, loserId, winnerId)) {
      return renderDuelScope({
        db: props.db,
        commandAlias: props.commandAlias,
        parentId: props.parentId,
        returnRootId,
        notice:
          'That choice contradicts existing duel results, so it was skipped.',
      });
    }

    recordComparison(props.db, winnerId, loserId);

    return renderDuelScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: props.parentId,
      returnRootId,
      notice: null,
    });
  }

  if (action === 'skip') {
    return renderDuelScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: props.parentId,
      returnRootId,
      notice: null,
    });
  }

  if (action === 'reset') {
    resetComparisons(props.db, props.parentId);

    return renderDuelScope({
      db: props.db,
      commandAlias: props.commandAlias,
      parentId: props.parentId,
      returnRootId,
      notice: 'Duel results for this scope were reset.',
    });
  }

  if (action === 'quit') {
    return renderList({
      db: props.db,
      commandAlias: props.commandAlias,
      rootId: returnRootId,
    });
  }

  return handleChoose(props);
}

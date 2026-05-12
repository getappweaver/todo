import type { Database } from 'bun:sqlite';

import type { WebAction, WebNode, WebNodeRoot } from '@src/web/ui-schema';

import { getTodo } from '../../db/todos';

import { handleListCommand } from '../list/handler';
import { renderListWeb } from '../list/renderers/web';
import { createListRepresentation } from '../list/representation/builder';

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

type RenderTodoCardProps = {
  db: Database;
  item: RankedTodo;
  label: 'A' | 'B' | null;
  action: WebAction | null;
  muted: boolean;
};

const duelWebStylesheet = {
  id: 'todo-duel-web',
  cssText: `
    .todo-duel-shell {
      border: 2px solid var(--color-warning);
      background: color-mix(in srgb, var(--color-surface-alt) 88%, var(--color-warning) 12%);
      box-shadow: 7px 7px 0 var(--color-panel-shadow);
    }

    .todo-duel-choice-card,
    .todo-duel-card {
      border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
      background: var(--color-surface);
    }

    .todo-duel-card--pair {
      border-color: color-mix(in srgb, var(--color-warning) 70%, var(--color-border));
    }

    .todo-duel-card--muted {
      opacity: 0.62;
    }

    .todo-duel-actions {
      flex-wrap: wrap;
    }

    .web-row.todo-duel-card-row {
      align-items: flex-start;
      gap: 2rem;
    }

    .todo-duel-pick-button {
      min-width: 4rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .web-button.todo-duel-danger-button {
      background: var(--color-danger);
      color: #000;
    }

    .web-button.todo-duel-danger-button:hover,
    .web-button.todo-duel-danger-button:focus-visible {
      background: color-mix(in srgb, var(--color-danger) 86%, #000 14%);
    }

    .todo-duel-children {
      margin-left: 0.75rem;
      padding-left: 0.75rem;
      border-left: 2px solid color-mix(in srgb, var(--color-warning) 50%, transparent);
    }
  `,
} as const;

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

function renderShell(props: {
  commandAlias: string;
  parentId: number | null;
  title: string;
  children: WebNode[];
}): WebNodeRoot {
  return {
    kind: 'ui',
    version: 1,
    meta: {
      command: props.commandAlias,
      subcommand: 'duel',
      arguments:
        props.parentId === null
          ? { duelArgs: ['web'] }
          : { parentId: props.parentId, duelArgs: ['web'] },
    },
    stylesheets: [duelWebStylesheet],
    tree: {
      type: 'element',
      tag: 'box',
      props: {
        className: 'todo-duel-shell',
        padding: 'md',
        scrollIntoViewOnMount: true,
      },
      children: [
        {
          type: 'element',
          tag: 'stack',
          props: { gap: 'md' },
          children: [
            {
              type: 'element',
              tag: 'stack',
              props: { gap: 'xs' },
              children: [
                {
                  type: 'element',
                  tag: 'text',
                  props: { weight: 'bold' },
                  children: [text('Todo Duel')],
                },
                {
                  type: 'element',
                  tag: 'text',
                  props: { tone: 'muted', size: 'sm' },
                  children: [text(props.title)],
                },
              ],
            },
            ...props.children,
          ],
        },
      ],
    },
  };
}

function renderMessage(props: {
  commandAlias: string;
  parentId: number | null;
  title: string;
  message: string;
}): WebNodeRoot {
  return renderShell({
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

  const title = selected
    ? `Choose duel scope for ${todoLabel(selected)}`
    : `Choose duel scope for #${props.selectedId}`;

  return renderShell({
    commandAlias: props.commandAlias,
    parentId: props.selectedId,
    title,
    children: [
      {
        type: 'element',
        tag: 'row',
        props: { gap: 'sm', className: 'todo-duel-actions' },
        children: [
          {
            type: 'element',
            tag: 'button',
            props: {
              label: `Duel children (${props.childCount})`,
              action: duelWebAction({
                commandAlias: props.commandAlias,
                parentId: props.selectedId,
                returnRootId: props.returnRootId,
                actionArgs: ['start', 'children'],
              }),
            },
          },
          {
            type: 'element',
            tag: 'button',
            props: {
              label: `Duel among siblings (${props.siblingCount})`,
              action: duelWebAction({
                commandAlias: props.commandAlias,
                parentId: props.selectedId,
                returnRootId: props.returnRootId,
                actionArgs: ['start', 'siblings'],
              }),
            },
          },
        ],
      },
    ],
  });
}

function renderTodoTree(db: Database, parentId: number): WebNode[] {
  return getRankedSiblings(db, parentId).map((child) => ({
    type: 'element' as const,
    tag: 'treeItem' as const,
    props: {
      id: `todo-duel-tree-item-${child.id}`,
      defaultExpanded: false,
    },
    summary: {
      type: 'element' as const,
      tag: 'text' as const,
      props: { size: 'sm' as const, tone: 'muted' as const },
      children: [text(todoLabel(child))],
    },
    children: renderTodoTree(db, child.id),
  }));
}

function renderTodoChildren(db: Database, itemId: number): WebNode[] {
  const children = getRankedSiblings(db, itemId);

  if (children.length === 0) {
    return [];
  }

  return [
    {
      type: 'element',
      tag: 'treeItem',
      props: {
        id: `todo-duel-children-${itemId}`,
        defaultExpanded: false,
      },
      summary: {
        type: 'element',
        tag: 'text',
        props: { tone: 'muted', size: 'sm' },
        children: [text(`${children.length} child item(s)`)],
      },
      children: [
        {
          type: 'element',
          tag: 'stack',
          props: { gap: 'xs', className: 'todo-duel-children' },
          children: renderTodoTree(db, itemId),
        },
      ],
    },
  ];
}

function renderTodoCard(props: RenderTodoCardProps): WebNode {
  return {
    type: 'element',
    tag: 'box',
    props: {
      padding: 'sm',
      className: [
        'todo-duel-card',
        props.label === null ? null : 'todo-duel-card--pair',
        props.muted ? 'todo-duel-card--muted' : null,
      ]
        .filter((value): value is string => value !== null)
        .join(' '),
    },
    children: [
      {
        type: 'element',
        tag: 'row',
        props: {
          itemAlign: 'start',
          className: 'todo-duel-card-row',
        },
        children: [
          ...(props.label === null
            ? []
            : [
                {
                  type: 'element' as const,
                  tag: 'button' as const,
                  props: {
                    label: props.label,
                    className: 'todo-duel-pick-button',
                    action: props.action ?? undefined,
                  },
                },
              ]),
          {
            type: 'element',
            tag: 'stack',
            props: { gap: 'xs', fill: true },
            children: [
              {
                type: 'element',
                tag: 'text',
                props: { weight: props.label === null ? 'normal' : 'bold' },
                children: [text(todoLabel(props.item))],
              },
              ...renderTodoChildren(props.db, props.item.id),
            ],
          },
        ],
      },
    ],
  };
}

function renderDuelComplete(props: RenderDuelScopeProps): WebNodeRoot {
  const ranked = getRankedSiblings(props.db, props.parentId);

  return renderShell({
    commandAlias: props.commandAlias,
    parentId: props.parentId,
    title: scopeTitle(props.db, props.parentId),
    children: [
      {
        type: 'element',
        tag: 'text',
        props: { weight: 'bold' },
        children: [text('All items in this scope are scored.')],
      },
      {
        type: 'element',
        tag: 'stack',
        props: { gap: 'xs' },
        children: ranked.map((item, index) => ({
          type: 'element' as const,
          tag: 'text' as const,
          children: [text(`${index + 1}. ${todoLabel(item)}`)],
        })),
      },
      {
        type: 'element',
        tag: 'row',
        props: { gap: 'sm', className: 'todo-duel-actions' },
        children: [
          {
            type: 'element',
            tag: 'button',
            props: {
              label: 'Done',
              action: duelWebAction({
                commandAlias: props.commandAlias,
                parentId: props.parentId,
                returnRootId: props.returnRootId,
                actionArgs: ['quit'],
              }),
            },
          },
          {
            type: 'element',
            tag: 'button',
            props: {
              label: 'Reset and re-duel',
              className: 'todo-duel-danger-button',
              action: duelWebAction({
                commandAlias: props.commandAlias,
                parentId: props.parentId,
                returnRootId: props.returnRootId,
                actionArgs: ['reset'],
              }),
            },
          },
        ],
      },
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

  return renderShell({
    commandAlias: props.commandAlias,
    parentId: props.parentId,
    title: scopeTitle(props.db, props.parentId),
    children: [
      ...(props.notice === null
        ? []
        : [
            {
              type: 'element' as const,
              tag: 'box' as const,
              props: {
                padding: 'sm' as const,
                className: 'todo-duel-choice-card',
              },
              children: [
                {
                  type: 'element' as const,
                  tag: 'text' as const,
                  props: { tone: 'warning' as const },
                  children: [text(props.notice)],
                },
              ],
            },
          ]),
      {
        type: 'element',
        tag: 'text',
        props: { weight: 'bold' },
        children: [
          text(
            `Question ${currentQuestion} of ${totalQuestions}: which is more important?`,
          ),
        ],
      },
      renderTodoCard({
        db: props.db,
        item: itemA,
        label: 'A',
        action: duelWebAction({
          commandAlias: props.commandAlias,
          parentId: props.parentId,
          returnRootId: props.returnRootId,
          actionArgs: ['answer', String(itemA.id), String(itemB.id)],
        }),
        muted: false,
      }),
      renderTodoCard({
        db: props.db,
        item: itemB,
        label: 'B',
        action: duelWebAction({
          commandAlias: props.commandAlias,
          parentId: props.parentId,
          returnRootId: props.returnRootId,
          actionArgs: ['answer', String(itemB.id), String(itemA.id)],
        }),
        muted: false,
      }),
      {
        type: 'element',
        tag: 'row',
        props: { gap: 'sm', className: 'todo-duel-actions' },
        children: [
          {
            type: 'element',
            tag: 'button',
            props: {
              label: 'Skip',
              action: duelWebAction({
                commandAlias: props.commandAlias,
                parentId: props.parentId,
                returnRootId: props.returnRootId,
                actionArgs: ['skip'],
              }),
            },
          },
          {
            type: 'element',
            tag: 'button',
            props: {
              label: 'Reset',
              action: duelWebAction({
                commandAlias: props.commandAlias,
                parentId: props.parentId,
                returnRootId: props.returnRootId,
                actionArgs: ['reset'],
              }),
            },
          },
          {
            type: 'element',
            tag: 'button',
            props: {
              label: 'Quit',
              action: duelWebAction({
                commandAlias: props.commandAlias,
                parentId: props.parentId,
                returnRootId: props.returnRootId,
                actionArgs: ['quit'],
              }),
            },
          },
        ],
      },
      ...(remaining.length === 0
        ? []
        : [
            {
              type: 'element' as const,
              tag: 'stack' as const,
              props: { gap: 'xs' as const },
              children: [
                {
                  type: 'element' as const,
                  tag: 'text' as const,
                  props: { tone: 'muted' as const, size: 'sm' as const },
                  children: [text('Other items in this scope')],
                },
                ...remaining.map((item) =>
                  renderTodoCard({
                    db: props.db,
                    item,
                    label: null,
                    action: null,
                    muted: true,
                  }),
                ),
              ],
            },
          ]),
    ],
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

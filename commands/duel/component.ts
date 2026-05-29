import type { WebAction, WebNode, WebNodeRoot } from '@src/web/ui-schema';

import {
  renderTodoTreeItems,
  type TodoTreeNode,
  type TodoTreeViewItem,
} from '../shared/tree-view';

export type DuelTodoItem = {
  id: number;
  todo: string;
  status: string;
  hasChampion: boolean;
  selectedChampion: boolean;
  children: DuelTodoItem[];
};

type DuelTreeViewItem = TodoTreeViewItem;

type ChampionTreeViewItem = TodoTreeViewItem & {
  pickAction: WebAction | null;
  storyTargetId: string | null;
  currentBranch: boolean;
  hasChampion: boolean;
  selectedChampion: boolean;
};

export type DuelButton = {
  label: string;
  action: WebAction;
  className: string | null;
  storyTargetId: string | null;
};

export type DuelChoice = {
  label: 'A' | 'B';
  item: DuelTodoItem;
  action: WebAction;
  storyTargetId: string | null;
};

export type ChampionChoice = {
  item: DuelTodoItem;
  action: WebAction;
  storyTargetId: string | null;
};

export type ChampionContext = {
  parentPath: string[];
  currentParentId: number | null;
  rootItems: DuelTodoItem[];
  defaultExpandedIds: number[];
};

export const duelWebStylesheet = {
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

    .todo-duel-card-title {
      white-space: pre-wrap;
    }

    .todo-duel-pick-button {
      min-width: 4rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .web-button.todo-duel-pick-button.todo-champion-pick-row {
      background: var(--color-accent);
      color: #000;
    }

    .web-button.todo-duel-pick-button.todo-champion-pick-row:hover,
    .web-button.todo-duel-pick-button.todo-champion-pick-row:focus-visible {
      background: color-mix(in srgb, var(--color-accent) 82%, #fff 18%);
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

    .todo-champion-tree {
      width: 100%;
    }

    .todo-champion-tree-children {
      margin-left: 0.7rem;
      padding-left: 0.65rem;
      border-left: 1px solid color-mix(in srgb, var(--color-warning) 42%, transparent);
    }

    .web-row.todo-champion-row {
      justify-content: space-between;
      gap: 0.5rem;
    }

    .web-row.todo-champion-row--current {
      background: color-mix(in srgb, var(--color-warning) 12%, transparent);
    }

    .web-row.todo-champion-row--accent .todo-champion-title {
      color: var(--color-accent);
      font-weight: 800;
    }

    .web-row.todo-champion-main-row {
      align-items: flex-start;
      gap: 0.35rem;
    }

    .web-checkbox.todo-champion-status {
      width: 1rem;
      height: 1rem;
      pointer-events: none;
    }

    .todo-champion-content {
      flex: 1;
      min-width: 0;
      gap: 0.2rem;
    }

    .todo-champion-title {
      margin-top: 0.1rem;
    }

    .todo-champion-pick-row {
      margin-left: auto;
    }

    .todo-prioritization-label {
      font-size: 0.9rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-warning);
    }

    .todo-prioritization-tree {
      border-left: 2px solid color-mix(in srgb, var(--color-warning) 58%, transparent);
      padding-left: 0.75rem;
    }

    .todo-prioritization-path-line {
      font-family: var(--font-mono);
      color: var(--color-text-muted);
    }

    .todo-prioritization-path-line--focus {
      color: var(--color-warning);
      font-weight: 800;
    }

    .todo-prioritization-siblings {
      border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
      padding-top: 0.5rem;
    }
  `,
} as const;

function text(value: string): WebNode {
  return { type: 'text', value };
}

function duelItemToTreeNode(
  item: DuelTodoItem,
  depth: number,
): TodoTreeNode<DuelTreeViewItem> {
  return {
    item: {
      id: item.id,
      text: item.todo,
      depth,
      description: null,
      status: item.status,
      hasChampion: item.hasChampion,
      selectedChampion: item.selectedChampion,
    },
    children: item.children.map((child) =>
      duelItemToTreeNode(child, depth + 1),
    ),
  };
}

function renderTodoTree(item: DuelTodoItem): WebNode[] {
  const nodes = item.children.map((child) => duelItemToTreeNode(child, 0));

  return renderTodoTreeItems({
    nodes,
    renderSummary: (child) => ({
      type: 'element' as const,
      tag: 'text' as const,
      props: { size: 'sm' as const, tone: 'muted' as const },
      children: [text(child.text)],
    }),
    itemIdPrefix: 'todo-duel-tree-item-',
    itemUi: 'todo-duel-tree-item',
    childrenClassName: 'todo-duel-children',
    defaultExpandedIds: new Set(),
    storyTargetPrefix: null,
  });
}

function championChoiceToTreeNode(
  choice: ChampionChoice,
  depth: number,
): TodoTreeNode<ChampionTreeViewItem> {
  return {
    item: {
      id: choice.item.id,
      text: choice.item.todo,
      depth,
      description: null,
      status: choice.item.status,
      pickAction: choice.action,
      storyTargetId: choice.storyTargetId,
      currentBranch: false,
      hasChampion: choice.item.hasChampion,
      selectedChampion: choice.item.selectedChampion,
    },
    children: choice.item.children.map((child) =>
      championChildToTreeNode(child, depth + 1),
    ),
  };
}

function championChildToTreeNode(
  item: DuelTodoItem,
  depth: number,
): TodoTreeNode<ChampionTreeViewItem> {
  return {
    item: {
      id: item.id,
      text: item.todo,
      depth,
      description: null,
      status: item.status,
      pickAction: null,
      storyTargetId: null,
      currentBranch: false,
      hasChampion: item.hasChampion,
      selectedChampion: item.selectedChampion,
    },
    children: item.children.map((child) =>
      championChildToTreeNode(child, depth + 1),
    ),
  };
}

function statusCheckboxNode(status: string): WebNode {
  return {
    type: 'element',
    tag: 'checkbox',
    props: {
      checked: status === 'done',
      ...(status === 'in_progress' ? { indeterminate: true } : {}),
      disabled: true,
      className: 'web-checkbox--retro todo-champion-status',
    },
  };
}

function renderChampionTreeItemSummary(item: ChampionTreeViewItem): WebNode {
  return {
    type: 'element',
    tag: 'row',
    props: {
      className: [
        'todo-champion-row',
        item.currentBranch ? 'todo-champion-row--current' : null,
        item.hasChampion || item.selectedChampion
          ? 'todo-champion-row--accent'
          : null,
      ]
        .filter((value): value is string => value !== null)
        .join(' '),
      storyTargetId: `todo-champion-row-${item.id}`,
    },
    children: [
      {
        type: 'element',
        tag: 'row',
        props: { className: 'todo-champion-main-row', fill: true },
        children: [
          statusCheckboxNode(item.status),
          {
            type: 'element',
            tag: 'stack',
            props: { className: 'todo-champion-content' },
            children: [
              {
                type: 'element',
                tag: 'text',
                props: {
                  weight: item.pickAction === null ? 'normal' : 'bold',
                  className: 'todo-champion-title',
                },
                children: [text(item.text)],
              },
            ],
          },
        ],
      },
      ...(item.pickAction === null
        ? []
        : [
            {
              type: 'element' as const,
              tag: 'button' as const,
              props: {
                label: 'Pick',
                className: 'todo-duel-pick-button todo-champion-pick-row',
                storyTargetId: item.storyTargetId ?? undefined,
                action: item.pickAction,
              },
            },
          ]),
    ],
  };
}

function renderTodoChildren(item: DuelTodoItem): WebNode[] {
  if (item.children.length === 0) {
    return [];
  }

  return [
    {
      type: 'element',
      tag: 'treeItem',
      props: {
        id: `todo-duel-children-${item.id}`,
        defaultExpanded: false,
      },
      summary: {
        type: 'element',
        tag: 'text',
        props: { tone: 'muted', size: 'sm' },
        children: [text(`${item.children.length} child item(s)`)],
      },
      children: [
        {
          type: 'element',
          tag: 'stack',
          props: { gap: 'xs', className: 'todo-duel-children' },
          children: renderTodoTree(item),
        },
      ],
    },
  ];
}

function renderDuelButton(button: DuelButton): WebNode {
  return {
    type: 'element',
    tag: 'button',
    props: {
      label: button.label,
      className: button.className ?? undefined,
      storyTargetId: button.storyTargetId ?? undefined,
      action: button.action,
    },
  };
}

function renderTodoCard(props: {
  item: DuelTodoItem;
  label: 'A' | 'B' | null;
  action: WebAction | null;
  storyTargetId: string | null;
  muted: boolean;
}): WebNode {
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
                    storyTargetId: props.storyTargetId ?? undefined,
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
                props: {
                  weight: props.label === null ? 'normal' : 'bold',
                  className: 'todo-duel-card-title',
                },
                children: [text(props.item.todo)],
              },
              ...renderTodoChildren(props.item),
            ],
          },
        ],
      },
    ],
  };
}

function currentBranchTreeNode(props: {
  parent: DuelTodoItem;
  choices: ChampionChoice[];
  depth: number;
}): TodoTreeNode<ChampionTreeViewItem> {
  return {
    item: {
      id: props.parent.id,
      text: props.parent.todo,
      depth: props.depth,
      description: null,
      status: props.parent.status,
      pickAction: null,
      storyTargetId: null,
      currentBranch: true,
      hasChampion: props.parent.hasChampion,
      selectedChampion: props.parent.selectedChampion,
    },
    children: props.choices.map((choice) =>
      championChoiceToTreeNode(choice, props.depth + 1),
    ),
  };
}

function championContextTreeNodes(props: {
  context: ChampionContext;
  choices: ChampionChoice[];
}): TodoTreeNode<ChampionTreeViewItem>[] {
  if (props.context.currentParentId === null) {
    return props.choices.map((choice) => championChoiceToTreeNode(choice, 0));
  }

  function buildNode(
    item: DuelTodoItem,
    depth: number,
  ): TodoTreeNode<ChampionTreeViewItem> {
    return item.id === props.context.currentParentId
      ? currentBranchTreeNode({
          parent: item,
          choices: props.choices,
          depth,
        })
      : {
          item: {
            id: item.id,
            text: item.todo,
            depth,
            description: null,
            status: item.status,
            pickAction: null,
            storyTargetId: null,
            currentBranch: false,
            hasChampion: item.hasChampion,
            selectedChampion: item.selectedChampion,
          },
          children: item.children.map((child) => buildNode(child, depth + 1)),
        };
  }

  return props.context.rootItems.map((item) => buildNode(item, 0));
}

function renderChampionChoiceTree(props: {
  context: ChampionContext;
  choices: ChampionChoice[];
}): WebNode {
  const nodes = championContextTreeNodes(props);

  const defaultExpandedIds = new Set<number>(props.context.defaultExpandedIds);

  return {
    type: 'element',
    tag: 'tree',
    props: {
      gap: 'xs',
      ui: 'todo-tree',
      className: 'todo-champion-tree',
    },
    children: renderTodoTreeItems({
      nodes,
      renderSummary: renderChampionTreeItemSummary,
      itemIdPrefix: `todo-champion-tree-item-${props.context.currentParentId ?? 'root'}-`,
      itemUi: 'todo-tree-item',
      childrenClassName: 'todo-champion-tree-children',
      defaultExpandedIds,
      storyTargetPrefix: 'todo-champion-tree-toggle-',
    }),
  };
}

function renderChampionContext(context: ChampionContext): WebNode[] {
  const target =
    context.parentPath.length === 0
      ? 'top-level todos'
      : context.parentPath.join(' → ');

  return [
    {
      type: 'element',
      tag: 'stack',
      props: { gap: 'xs' },
      children: [
        {
          type: 'element',
          tag: 'text',
          props: { className: 'todo-prioritization-label' },
          children: [text('Prioritization')],
        },
        {
          type: 'element',
          tag: 'text',
          props: { tone: 'muted', size: 'sm' },
          children: [text(`Pick a champion for ${target}.`)],
        },
      ],
    },
  ];
}

export function renderDuelShell(props: {
  commandAlias: string;
  parentId: number | null;
  title: string | null;
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
            ...(props.title === null
              ? []
              : [
                  {
                    type: 'element' as const,
                    tag: 'text' as const,
                    props: { weight: 'bold' as const },
                    children: [text(props.title)],
                  },
                ]),
            ...props.children,
          ],
        },
      ],
    },
  };
}

export function renderDuelQuestion(props: {
  commandAlias: string;
  parentId: number | null;
  title: string;
  notice: string | null;
  question: string;
  a: DuelChoice;
  b: DuelChoice;
  actions: DuelButton[];
  remaining: DuelTodoItem[];
}): WebNodeRoot {
  return renderDuelShell({
    commandAlias: props.commandAlias,
    parentId: props.parentId,
    title: null,
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
        children: [text(props.question)],
      },
      renderTodoCard({
        item: props.a.item,
        label: props.a.label,
        action: props.a.action,
        storyTargetId: props.a.storyTargetId,
        muted: false,
      }),
      renderTodoCard({
        item: props.b.item,
        label: props.b.label,
        action: props.b.action,
        storyTargetId: props.b.storyTargetId,
        muted: false,
      }),
      {
        type: 'element',
        tag: 'row',
        props: { gap: 'sm', className: 'todo-duel-actions' },
        children: props.actions.map(renderDuelButton),
      },
      ...(props.remaining.length === 0
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
                ...props.remaining.map((item) =>
                  renderTodoCard({
                    item,
                    label: null,
                    action: null,
                    storyTargetId: null,
                    muted: true,
                  }),
                ),
              ],
            },
          ]),
    ],
  });
}

export function renderChampionQuestion(props: {
  commandAlias: string;
  parentId: number | null;
  title: string | null;
  notice: string | null;
  context: ChampionContext;
  choices: ChampionChoice[];
  actions: DuelButton[];
}): WebNodeRoot {
  return renderDuelShell({
    commandAlias: props.commandAlias,
    parentId: props.parentId,
    title: null,
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
      ...renderChampionContext(props.context),
      renderChampionChoiceTree({
        context: props.context,
        choices: props.choices,
      }),
      {
        type: 'element',
        tag: 'row',
        props: { gap: 'sm', className: 'todo-duel-actions' },
        children: props.actions.map(renderDuelButton),
      },
    ],
  });
}

export function renderStaleChampionQuestion(props: {
  commandAlias: string;
  parentId: number | null;
  notice: string | null;
  context: ChampionContext;
  champion: DuelTodoItem;
  actions: DuelButton[];
}): WebNodeRoot {
  return renderDuelShell({
    commandAlias: props.commandAlias,
    parentId: props.parentId,
    title: null,
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
      ...renderChampionContext(props.context),
      {
        type: 'element',
        tag: 'text',
        props: { tone: 'muted', size: 'sm' },
        children: [
          text(
            'This branch changed, but the previous champion is still active. Keep it or choose again?',
          ),
        ],
      },
      renderTodoCard({
        item: { ...props.champion, selectedChampion: true },
        label: null,
        action: null,
        storyTargetId: null,
        muted: false,
      }),
      {
        type: 'element',
        tag: 'row',
        props: { gap: 'sm', className: 'todo-duel-actions' },
        children: props.actions.map(renderDuelButton),
      },
    ],
  });
}

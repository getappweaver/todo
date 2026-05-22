import type { WebAction, WebNode, WebNodeRoot } from '@src/web/ui-schema';

export type DuelTodoItem = {
  id: number;
  todo: string;
  children: DuelTodoItem[];
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

function renderTodoTree(item: DuelTodoItem): WebNode[] {
  return item.children.map((child) => ({
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
      children: [text(child.todo)],
    },
    children: renderTodoTree(child),
  }));
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
                props: { weight: props.label === null ? 'normal' : 'bold' },
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

export function renderDuelShell(props: {
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
    title: props.title,
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

export function renderDuelScopeChoice(props: {
  commandAlias: string;
  selectedId: number;
  returnRootId: number | null;
  title: string;
  childCount: number;
  siblingCount: number;
  childrenStoryTargetId: string | null;
  siblingsStoryTargetId: string | null;
}): WebNodeRoot {
  const returnRoot = props.returnRootId ?? 'root';

  return renderDuelShell({
    commandAlias: props.commandAlias,
    parentId: props.selectedId,
    title: props.title,
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
              storyTargetId: props.childrenStoryTargetId ?? undefined,
              action: {
                type: 'command',
                command: props.commandAlias,
                subcommand: 'duel',
                arguments: {
                  parentId: props.selectedId,
                  duelArgs: [
                    'web',
                    'start',
                    'children',
                    'returnRoot',
                    String(returnRoot),
                  ],
                },
                options: {},
                recordInTimeline: false,
              },
            },
          },
          {
            type: 'element',
            tag: 'button',
            props: {
              label: `Duel among siblings (${props.siblingCount})`,
              storyTargetId: props.siblingsStoryTargetId ?? undefined,
              action: {
                type: 'command',
                command: props.commandAlias,
                subcommand: 'duel',
                arguments: {
                  parentId: props.selectedId,
                  duelArgs: [
                    'web',
                    'start',
                    'siblings',
                    'returnRoot',
                    String(returnRoot),
                  ],
                },
                options: {},
                recordInTimeline: false,
              },
            },
          },
        ],
      },
    ],
  });
}

export function renderDuelComplete(props: {
  commandAlias: string;
  parentId: number | null;
  title: string;
  ranked: DuelTodoItem[];
  actions: DuelButton[];
}): WebNodeRoot {
  return renderDuelShell({
    commandAlias: props.commandAlias,
    parentId: props.parentId,
    title: props.title,
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
        children: props.ranked.map((item, index) => ({
          type: 'element' as const,
          tag: 'text' as const,
          children: [text(`${index + 1}. ${item.todo}`)],
        })),
      },
      {
        type: 'element',
        tag: 'row',
        props: { gap: 'sm', className: 'todo-duel-actions' },
        children: props.actions.map(renderDuelButton),
      },
    ],
  });
}

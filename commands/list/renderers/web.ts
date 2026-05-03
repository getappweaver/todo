import type { WebRenderContext } from '@src/system/render-context';
import type { WebAction, WebNode, WebNodeRoot } from '@src/web/ui-schema';

import type { ListItem, ListRepresentation } from '../representation/schema';

/** Matches `WebRefreshSchema` (list re-fetch after a mutating action). */
type WebRefreshPayload = {
  command: string;
  subcommand: string;
  arguments: Record<string, unknown>;
  options: Record<string, unknown>;
};

type BuildFocusedScopeWebNodeProps = {
  commandAlias: string;
  /**
   * When set (list card in focus mode), after `unfocus` the client re-fetches this `list`
   * so the same timeline card updates in place. Focus-success **messages** have no
   * `listInvocation` echo — pass `null`; unfocus still runs, without in-place list refresh.
   */
  refresh: WebRefreshPayload | null;
};

type TodoTreeNode = {
  item: ListItem;
  children: TodoTreeNode[];
};

const todoListStylesheet = {
  id: 'todo-list-web',
  cssText: `
    .web-row.todo-item-row {
      justify-content: space-between;
      gap: 0.35rem;
    }

    .web-row.todo-item-main-row {
      align-items: flex-start;
      gap: 0.35rem;
    }

    .web-row.todo-item-row:hover .web-text.todo-item-title {
      font-weight: 600;
    }

    .web-stack.todo-item-content {
      flex: 1;
      min-width: 0;
      gap: 0.25rem;
    }

    .web-text.todo-item-id {
      white-space: nowrap;
    }

    .web-overflow-trigger.todo-status-trigger {
      opacity: 1;
      width: 1rem;
      height: 1rem;
    }

    /* Menu root gets data-ui from overflow props so panel alignment works with checkbox trigger. */
    .web-overflow-menu[data-ui='todo-status-menu'] .web-overflow-panel {
      left: 0;
      right: auto;
    }

    .web-overflow-menu[data-ui='todo-status-menu'] .web-overflow-panel .web-button {
      padding: 0 !important;
    }

    .web-overflow-menu[data-ui='todo-status-menu'] .web-overflow-panel .web-button.todo-status-current-option {
      background: var(--color-warning);
      color: #000;
    }

    .web-form.todo-inline-add-form {
      margin: 0.35rem 0 0.45rem 1.4rem;
      padding: 0.55rem;
      border-left: 2px solid color-mix(in srgb, var(--color-warning) 70%, transparent);
      background: color-mix(in srgb, var(--color-surface-alt) 92%, var(--color-warning) 8%);
    }

    .web-button.todo-new-root-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      min-height: 1rem;
      border: none;
      border-radius: 0;
      background: color-mix(in srgb, var(--color-warning) 88%, transparent);
      color: #000;
      font: inherit;
      font-weight: 700;
      font-size: 0.88rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      box-shadow: 6px 6px 0 var(--color-panel-shadow);
      cursor: pointer;
    }
    .web-button.todo-new-root-button:hover,
    .web-button.todo-new-root-button:focus-visible {
      background: var(--color-warning);
    }
  `,
} as const;

function listRefresh(representation: ListRepresentation): WebRefreshPayload {
  return {
    command: representation.meta.command,
    subcommand: 'list',
    arguments: { ...representation.data.listInvocation.arguments },
    options: { ...representation.data.listInvocation.options },
  };
}

function inlineAddRevealId(itemId: number, kind: 'child' | 'sibling'): string {
  return `todo-inline-add-${kind}-${itemId}`;
}

/** Generic `form` + `textField` + `button` (submit); `WebAction` is merged with FormData on the client. */
function buildListAiCommandForm(representation: ListRepresentation): WebNode {
  const command = representation.meta.command;
  const li = representation.data.listInvocation;
  const r = listRefresh(representation);

  return {
    type: 'element',
    tag: 'form',
    props: {
      className: 'web-form web-form--stacked web-form--ai-prompt',
      action: {
        type: 'command',
        command,
        subcommand: 'ai',
        arguments: { prompt: '' },
        options: {},
        recordInTimeline: true,
        refresh: {
          command: r.command,
          subcommand: r.subcommand,
          arguments: { ...li.arguments },
          options: { ...li.options },
        },
      },
    },
    children: [
      {
        type: 'element',
        tag: 'textArea',
        props: {
          formFieldName: 'prompt',
          inputPlaceholder:
            'Add or edit items using a prompt like "Add items from the file.md"',
          maxRows: 4,
          storyTargetId: 'todo-ai-prompt-text',
        },
      },
      {
        type: 'element',
        tag: 'row',
        props: { className: 'web-form__actions' },
        children: [
          {
            type: 'element',
            tag: 'button',
            props: {
              label: 'Run AI',
              htmlType: 'submit',
              storyTargetId: 'todo-ai-prompt-submit',
            },
          },
        ],
      },
    ],
  };
}

/** Title text for a todo id (for generic `optionHints.under.hint`). */
function todoTitleForUnderId(
  representation: ListRepresentation,
  underId: number,
): string {
  const row = representation.data.items.find((i) => i.id === underId);

  return row ? row.text.replace(/\s+/g, ' ').trim().slice(0, 200) : '?';
}

function revealInlineAddFormAction(targetId: string): WebAction {
  return {
    type: 'reveal',
    targetId,
  };
}

function hideInlineAddFormAction(targetId: string): WebAction {
  return {
    type: 'hideReveal',
    targetId,
  };
}

type BuildInlineTodoAddFormProps = {
  representation: ListRepresentation;
  revealId: string;
  underParentId: number | null;
  placeholder: string;
};

/** Inline widget form for `/… add`; `underParentId` is `--under` (omit when `null`, e.g. root sibling). */
function buildInlineTodoAddForm({
  representation,
  revealId,
  underParentId,
  placeholder,
}: BuildInlineTodoAddFormProps): WebNode {
  const refresh = listRefresh(representation);
  const command = representation.meta.command;

  return {
    type: 'element',
    tag: 'form',
    props: {
      className: 'web-form web-form--stacked todo-inline-add-form',
      revealId,
      hiddenUntilRevealed: true,
      action: {
        type: 'command',
        command,
        subcommand: 'add',
        arguments: { text: '' },
        options: underParentId === null ? {} : { under: underParentId },
        recordInTimeline: false,
        refresh,
      },
    },
    children: [
      {
        type: 'element',
        tag: 'text',
        props: { tone: 'muted', size: 'sm' },
        children: [
          {
            type: 'text',
            value:
              underParentId === null
                ? 'Add a top-level sibling.'
                : `Add under #${underParentId}: ${todoTitleForUnderId(representation, underParentId)}`,
          },
        ],
      },
      {
        type: 'element',
        tag: 'textField',
        props: {
          formFieldName: 'text',
          inputPlaceholder: placeholder,
          autoFocus: true,
          storyTargetId: 'todo-add-text',
        },
      },
      {
        type: 'element',
        tag: 'row',
        props: { className: 'web-form__actions', gap: 'sm' },
        children: [
          {
            type: 'element',
            tag: 'button',
            props: {
              label: 'Add',
              htmlType: 'submit',
              storyTargetId: 'todo-add-submit',
            },
          },
          {
            type: 'element',
            tag: 'button',
            props: {
              label: 'Close',
              className: 'web-button',
              action: hideInlineAddFormAction(revealId),
            },
          },
        ],
      },
    ],
  };
}

function buildEmptyTodoListPrompt(representation: ListRepresentation): WebNode {
  const revealId = 'todo-inline-add-root-empty';

  return {
    type: 'element',
    tag: 'stack',
    props: { gap: 'sm' },
    children: [
      {
        type: 'element',
        tag: 'text',
        props: { tone: 'muted' },
        children: [{ type: 'text', value: 'No todos yet.' }],
      },
      {
        type: 'element',
        tag: 'button',
        props: {
          label: 'Add a new root item',
          className: 'todo-new-root-button',
          storyTargetId: 'todo-new-root',
          action: revealInlineAddFormAction(revealId),
        },
      },
      buildInlineTodoAddForm({
        representation,
        revealId,
        underParentId: null,
        placeholder: 'New todo',
      }),
    ],
  };
}

/** Inline hint while focused: link runs `unfocus` (title is visible in the list above). */
export function buildFocusedScopeWebNode(
  params: BuildFocusedScopeWebNodeProps,
): WebNode {
  const unfocusAction: WebAction = {
    type: 'command',
    command: params.commandAlias,
    subcommand: 'unfocus',
    arguments: {},
    options: {},
    ...(params.refresh !== null ? { refresh: params.refresh } : {}),
  };

  return {
    type: 'element',
    tag: 'text',
    props: {
      size: 'sm',
    },
    children: [
      {
        type: 'element',
        tag: 'button',
        props: {
          label: 'unfocus',
          action: unfocusAction,
          className: 'web-button--link',
        },
      },
      { type: 'text', value: ' to see the whole list' },
    ],
  };
}

function winRateLabel(item: ListItem): string | undefined {
  if (item.winRate === null) {
    return undefined;
  }

  const pct = Math.round(item.winRate * 100);

  return `${pct}% · ${item.wins}W/${item.losses}L`;
}

function setTodoPendingAction(
  representation: ListRepresentation,
  item: ListItem,
): WebAction {
  const refresh = listRefresh(representation);
  const command = representation.meta.command;

  return {
    type: 'command',
    command,
    subcommand: 'update',
    arguments: {
      id: item.id,
      field: 'status',
      value: 'pending',
    },
    options: {},
    recordInTimeline: false,
    refresh,
  };
}

function setTodoInProgressAction(
  representation: ListRepresentation,
  item: ListItem,
): WebAction {
  return {
    type: 'command',
    command: representation.meta.command,
    subcommand: 'start',
    arguments: { id: item.id },
    options: {},
    recordInTimeline: false,
    refresh: listRefresh(representation),
  };
}

function setTodoDoneAction(
  representation: ListRepresentation,
  item: ListItem,
): WebAction {
  return {
    type: 'command',
    command: representation.meta.command,
    subcommand: 'done',
    arguments: { id: item.id },
    options: {},
    recordInTimeline: false,
    refresh: listRefresh(representation),
  };
}

function deleteTodoAction(
  representation: ListRepresentation,
  item: ListItem,
): WebAction {
  return {
    type: 'command',
    command: representation.meta.command,
    subcommand: 'delete',
    arguments: { id: item.id },
    options: {},
    refresh: listRefresh(representation),
  };
}

function focusTodoAction(
  representation: ListRepresentation,
  item: ListItem,
): WebAction {
  return {
    type: 'command',
    command: representation.meta.command,
    subcommand: 'focus',
    arguments: { id: item.id },
    options: {},
    refresh: listRefresh(representation),
  };
}

function duelTodoAction(
  representation: ListRepresentation,
  item: ListItem,
): WebAction {
  return {
    type: 'command',
    command: representation.meta.command,
    subcommand: 'duel',
    arguments: { parentId: item.id },
    options: {},
    recordInTimeline: true,
    refresh: listRefresh(representation),
  };
}

function renderTodoItemRow(
  representation: ListRepresentation,
  item: ListItem,
): WebNode {
  const addChildRevealId = inlineAddRevealId(item.id, 'child');
  const addSiblingRevealId = inlineAddRevealId(item.id, 'sibling');

  const mainChildren: WebNode[] = [
    {
      type: 'element',
      tag: 'row',
      props: {
        className: 'todo-item-main-row',
      },
      children: [
        {
          type: 'element',
          tag: 'text',
          props: { weight: 'normal', className: 'todo-item-title' },
          children: [
            { type: 'text', value: item.text },
            {
              type: 'element',
              tag: 'text',
              props: {
                tone: 'muted',
                size: 'sm',
                className: 'todo-item-id',
              },
            },
          ],
        },
        {
          type: 'element',
          tag: 'badge',
          props: {
            label: winRateLabel(item),
            tone: 'muted',
            size: 'sm',
          },
        },
      ],
    },
  ];

  if (representation.data.showDescriptions && item.description?.trim()) {
    for (const line of item.description.trim().split('\n')) {
      mainChildren.push({
        type: 'element',
        tag: 'text',
        props: {
          tone: 'muted',
          size: 'sm',
        },
        children: [{ type: 'text', value: line }],
      });
    }
  }

  return {
    type: 'element',
    tag: 'row',
    props: {
      className: 'todo-item-row',
      storyTargetId: `todo-row-${item.id}`,
    },
    children: [
      {
        type: 'element',
        tag: 'overflowMenu',
        props: {
          label: 'Set todo status',
          checked: item.status === 'done',
          ...(item.status === 'in_progress' ? { indeterminate: true } : {}),
          className: 'todo-status-trigger web-checkbox--retro',
          ui: 'todo-status-menu',
        },
        children: [
          {
            type: 'element',
            tag: 'menuItem',
            props: {
              label: 'Set as pending',
              className:
                item.status === 'pending'
                  ? 'todo-status-current-option'
                  : undefined,
              tone: item.status === 'pending' ? 'warning' : undefined,
              action: setTodoPendingAction(representation, item),
            },
          },
          {
            type: 'element',
            tag: 'menuItem',
            props: {
              label: 'Set as in progress',
              className:
                item.status === 'in_progress'
                  ? 'todo-status-current-option'
                  : undefined,
              tone: item.status === 'in_progress' ? 'warning' : undefined,
              action: setTodoInProgressAction(representation, item),
            },
          },
          {
            type: 'element',
            tag: 'menuItem',
            props: {
              label: 'Set as done',
              className:
                item.status === 'done'
                  ? 'todo-status-current-option'
                  : undefined,
              tone: item.status === 'done' ? 'warning' : undefined,
              action: setTodoDoneAction(representation, item),
            },
          },
        ],
      },
      {
        type: 'element',
        tag: 'stack',
        props: { className: 'todo-item-content' },
        children: mainChildren,
      },
      {
        type: 'element',
        tag: 'overflowMenu',
        props: {
          label: '\u22EE',
          buttonVariant: 'icon',
          storyTargetId: `todo-row-actions-${item.id}`,
        },
        children: [
          {
            type: 'element',
            tag: 'menuItem',
            props: {
              label: 'Add child…',
              storyTargetId: `todo-add-child-${item.id}`,
              action: revealInlineAddFormAction(addChildRevealId),
            },
          },
          {
            type: 'element',
            tag: 'menuItem',
            props: {
              label: 'Add sibling…',
              storyTargetId: `todo-add-sibling-${item.id}`,
              action: revealInlineAddFormAction(addSiblingRevealId),
            },
          },
          {
            type: 'element',
            tag: 'menuItem',
            props: {
              label: 'Focus on',
              action: focusTodoAction(representation, item),
            },
          },
          {
            type: 'element',
            tag: 'menuItem',
            props: {
              label: 'Duel',
              storyTargetId: `todo-duel-${item.id}`,
              action: duelTodoAction(representation, item),
            },
          },
          {
            type: 'element',
            tag: 'menuItem',
            props: {
              label: 'Delete',
              tone: 'danger',
              action: deleteTodoAction(representation, item),
            },
          },
        ],
      },
    ],
  };
}

function buildItemTree(
  items: ListItem[],
  startIndex = 0,
): { nodes: TodoTreeNode[]; nextIndex: number } {
  const roots: TodoTreeNode[] = [];
  let index = startIndex;

  while (index < items.length) {
    const item = items[index];
    const parentDepth = item.depth;
    index += 1;

    const children: TodoTreeNode[] = [];
    while (index < items.length && items[index].depth > parentDepth) {
      const childResult = buildItemTree(items, index);

      if (childResult.nodes.length > 0) {
        children.push(...childResult.nodes);
      }

      index = childResult.nextIndex;
    }

    roots.push({ item, children });

    if (index < items.length && items[index].depth < parentDepth) {
      break;
    }
  }

  return { nodes: roots, nextIndex: index };
}

function renderTreeItem(
  representation: ListRepresentation,
  node: TodoTreeNode,
): WebNode {
  const item = node.item;

  const filterText = [item.text, item.description, item.status, `#${item.id}`]
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    .join('\n');

  return {
    type: 'element',
    tag: 'treeItem',
    props: {
      id: `todo-tree-item-${item.id}`,
      ui: 'todo-tree-item',
      filterText,
      filterName: item.text,
      filterPath: `${item.id}`,
      defaultExpanded: true,
    },
    summary: {
      type: 'element',
      tag: 'stack',
      props: {
        gap: 'xs',
      },
      children: [
        renderTodoItemRow(representation, item),
        buildInlineTodoAddForm({
          representation,
          revealId: inlineAddRevealId(item.id, 'child'),
          underParentId: item.id,
          placeholder: 'New child todo',
        }),
        buildInlineTodoAddForm({
          representation,
          revealId: inlineAddRevealId(item.id, 'sibling'),
          underParentId: item.parentId,
          placeholder: 'New sibling todo',
        }),
      ],
    },
    children: [
      ...(node.children.length > 0
        ? [
            {
              type: 'element' as const,
              /** Use `stack`, not nested `tree`, so only the root list gets bulk expand/collapse controls. */
              tag: 'stack' as const,
              props: {
                gap: 'xs' as const,
                className: 'todo-tree-children',
              },
              children: node.children.map((child) =>
                renderTreeItem(representation, child),
              ),
            },
          ]
        : []),
    ],
  };
}

function renderFlatTodoItem(
  representation: ListRepresentation,
  item: ListItem,
): WebNode {
  return {
    type: 'element',
    tag: 'stack',
    props: {
      gap: 'xs',
    },
    children: [
      renderTodoItemRow(representation, item),
      buildInlineTodoAddForm({
        representation,
        revealId: inlineAddRevealId(item.id, 'child'),
        underParentId: item.id,
        placeholder: 'New child todo',
      }),
      buildInlineTodoAddForm({
        representation,
        revealId: inlineAddRevealId(item.id, 'sibling'),
        underParentId: item.parentId,
        placeholder: 'New sibling todo',
      }),
    ],
  };
}

export function renderListWeb(
  representation: ListRepresentation,
  _context: WebRenderContext,
): WebNodeRoot {
  const treeChildren: WebNode[] = [buildListAiCommandForm(representation)];

  if (representation.data.scope) {
    treeChildren.push(
      buildFocusedScopeWebNode({
        commandAlias: representation.meta.command,
        refresh: listRefresh(representation),
      }),
    );
  }

  if (representation.data.view === 'tree') {
    const tree = buildItemTree(representation.data.items).nodes;

    if (tree.length === 0) {
      treeChildren.push(buildEmptyTodoListPrompt(representation));
    } else {
      treeChildren.push({
        type: 'element',
        tag: 'tree',
        props: {
          gap: 'xs',
          ui: 'todo-tree',
          filterable: true,
          filterIndexKey: `todo-tree:${representation.data.scope?.rootId ?? 'root'}:${representation.data.items.length}`,
          filterPlaceholder: 'Filter todos',
        },
        children: tree.map((node) => renderTreeItem(representation, node)),
      });
    }
  } else {
    treeChildren.push(
      representation.data.items.length === 0
        ? buildEmptyTodoListPrompt(representation)
        : {
            type: 'element',
            tag: 'stack',
            props: {
              gap: 'xs',
            },
            children: representation.data.items.map((item) =>
              renderFlatTodoItem(representation, item),
            ),
          },
    );
  }

  return {
    kind: 'ui',
    version: 1,
    meta: representation.meta,
    stylesheets: [todoListStylesheet],
    tree: {
      type: 'element',
      tag: 'stack',
      props: {
        gap: 'md',
      },
      children: treeChildren,
    },
  };
}

import type { WebRenderContext } from '@src/system/render-context';
import type { WebAction, WebNode, WebNodeRoot } from '@src/web/ui-schema';

import type { ListItem, ListRepresentation } from '../representation/schema';

/** Matches `WebRefreshSchema` (list re-fetch after a mutating action). */
type WebRefreshPayload = {
  command: string;
  subcommand: string;
  arguments: Record<string, unknown>;
  options: Record<string, unknown>;
  highlightTargetIds?: string[];
  highlightTargetIdFromOutput?: { pattern: string; template: string };
  expandTreeItemIds?: string[];
  expandTreeItemIdFromOption?: { option: string; template: string };
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

type TodoListFilterStatus = 'pending' | 'in_progress' | 'done';

const TODO_TEXT_STATUS: Record<ListItem['status'], string> = {
  pending: '[ ]',
  in_progress: '[~]',
  done: '[x]',
  cancelled: '[-]',
};

const TODO_LIST_FILTER_STATUSES: Array<{
  status: TodoListFilterStatus;
  label: string;
}> = [
  { status: 'pending', label: 'Pending' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'done', label: 'Done' },
];

const DEFAULT_TODO_LIST_FILTER_STATUSES: TodoListFilterStatus[] = [
  'pending',
  'in_progress',
];

const STATUS_FILTER_REVEAL_ID = 'todo-list-status-filter';

const todoListStylesheet = {
  id: 'todo-list-web',
  cssText: `
    .web-row.todo-item-row {
      justify-content: space-between;
      gap: 0.35rem;
    }

    .web-stack.todo-list-root {
      width: 100%;
      max-width: 52rem;
    }

    .web-row.todo-item-main-row {
      align-items: flex-start;
      gap: 0.35rem;
    }

    .web-row.todo-item-row .web-text.todo-item-title {
      margin-top: 0.1rem;
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
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 1px 10px !important;
      color: #000;
    }

    .web-overflow-menu[data-ui='todo-status-menu'] .web-overflow-panel .web-button .web-node {
      color: #000;
    }

    .web-checkbox.todo-status-menu-checkbox {
      width: 1rem;
      height: 1rem;
      pointer-events: none;
    }

    .web-checkbox.web-checkbox--retro.todo-status-menu-checkbox,
    .web-checkbox.web-checkbox--retro.todo-status-menu-checkbox:checked,
    .web-checkbox.web-checkbox--retro.todo-status-menu-checkbox:indeterminate {
      border: 1px solid #000;
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

    .web-form.todo-ai-prompt-form.web-form--stacked {
      gap: 0.35rem;
      margin-top: 0.25rem;
    }

    .web-stack.todo-status-filter-panel {
      padding: 0.65rem;
      border: 1px solid color-mix(in srgb, var(--color-border) 75%, transparent);
      background: color-mix(in srgb, var(--color-surface-alt) 94%, var(--color-warning) 6%);
    }

    .web-text.todo-status-filter-label {
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .web-row.todo-status-filter-choices {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.45rem;
    }

    .web-button.todo-status-filter-choice {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 1px 10px;
      min-width: 8rem;
      border: none;
      background: transparent;
      color: #fff;
      font-weight: 800;
      box-shadow: none;
      transform: none;
      cursor: pointer;
    }

    .web-button.todo-status-filter-choice:active {
      box-shadow: none;
      transform: none;
    }

    .web-button.todo-status-filter-choice .web-node {
      color: inherit;
    }

    .web-button.todo-status-filter-choice:not(.is-selected):hover,
    .web-button.todo-status-filter-choice:not(.is-selected):focus-visible {
      background: color-mix(in srgb, var(--color-warning) 58%, transparent);
      color: #000;
    }

    .web-button.todo-status-filter-choice.is-selected {
      background: var(--color-warning);
      color: #000;
    }

    .web-button.todo-status-filter-choice.is-selected:hover,
    .web-button.todo-status-filter-choice.is-selected:focus-visible {
      background: color-mix(in srgb, var(--color-warning) 78%, transparent);
    }

    .web-button.todo-status-filter-choice .web-checkbox.todo-status-menu-checkbox {
      width: 1rem;
      height: 1rem;
      border: 1px solid #000;
      pointer-events: none;
    }

    .web-button.todo-status-filter-choice .web-checkbox.web-checkbox--retro.todo-status-menu-checkbox,
    .web-button.todo-status-filter-choice .web-checkbox.web-checkbox--retro.todo-status-menu-checkbox:checked,
    .web-button.todo-status-filter-choice .web-checkbox.web-checkbox--retro.todo-status-menu-checkbox:indeterminate {
      border: 1px solid #000;
    }

    .web-row.todo-status-filter-actions {
      justify-content: center;
      gap: 0.65rem;
      margin-top: 1rem;
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

function rowHighlightTargetId(itemId: number): string {
  return `todo-row-${itemId}`;
}

function listRefreshHighlightingCreatedTodo(
  representation: ListRepresentation,
  underParentId: number | null,
): WebRefreshPayload {
  return {
    ...listRefresh(representation),
    highlightTargetIdFromOutput: {
      pattern: 'Todo created: #(\\d+)',
      template: 'todo-row-$1',
    },
    ...(underParentId === null
      ? {}
      : { expandTreeItemIds: [`todo-tree-item-${underParentId}`] }),
  };
}

function listRefreshHighlightingTodo(
  representation: ListRepresentation,
  itemId: number,
): WebRefreshPayload {
  return {
    ...listRefresh(representation),
    highlightTargetIds: [rowHighlightTargetId(itemId)],
  };
}

function listRefreshHighlightingMovedTodo(
  representation: ListRepresentation,
  itemId: number,
): WebRefreshPayload {
  return {
    ...listRefreshHighlightingTodo(representation, itemId),
    expandTreeItemIdFromOption: {
      option: 'under',
      template: 'todo-tree-item-$1',
    },
  };
}

function normalizeStatusFilters(value: unknown): TodoListFilterStatus[] {
  const rawValues = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value];

  const selected = new Set<TodoListFilterStatus>();

  for (const raw of rawValues) {
    if (raw === 'all') {
      return TODO_LIST_FILTER_STATUSES.map((entry) => entry.status);
    }

    if (raw === 'pending' || raw === 'in_progress' || raw === 'done') {
      selected.add(raw);
    }
  }

  return selected.size > 0
    ? TODO_LIST_FILTER_STATUSES.map((entry) => entry.status).filter((status) =>
        selected.has(status),
      )
    : [...DEFAULT_TODO_LIST_FILTER_STATUSES];
}

function hasExplicitStatusFilter(representation: ListRepresentation): boolean {
  return representation.data.listInvocation.options.status !== undefined;
}

function statusFilterListAction(
  representation: ListRepresentation,
  statuses: TodoListFilterStatus[],
): WebAction {
  const options = { ...representation.data.listInvocation.options };

  options.status = statuses;

  return {
    type: 'command',
    command: representation.meta.command,
    subcommand: 'list',
    arguments: { ...representation.data.listInvocation.arguments },
    options,
    recordInTimeline: false,
    revealIds: [STATUS_FILTER_REVEAL_ID],
  };
}

function toggleStatusFilterAction(
  representation: ListRepresentation,
  status: TodoListFilterStatus,
): WebAction {
  const selected = normalizeStatusFilters(
    representation.data.listInvocation.options.status,
  );

  const next = selected.includes(status)
    ? selected.filter((item) => item !== status)
    : [...selected, status];

  return statusFilterListAction(representation, next);
}

function statusCheckboxNode(status: TodoListFilterStatus): WebNode {
  return {
    type: 'element',
    tag: 'checkbox',
    props: {
      checked: status === 'done',
      ...(status === 'in_progress' ? { indeterminate: true } : {}),
      disabled: true,
      className: 'web-checkbox--retro todo-status-menu-checkbox',
    },
  };
}

function statusOptionChildren(
  status: TodoListFilterStatus,
  label: string,
): WebNode[] {
  return [
    statusCheckboxNode(status),
    {
      type: 'element',
      tag: 'text',
      children: [{ type: 'text', value: label }],
    },
  ];
}

function buildStatusFilterPanel(
  representation: ListRepresentation,
  hiddenUntilRevealed: boolean,
): WebNode {
  const selected = normalizeStatusFilters(
    representation.data.listInvocation.options.status,
  );

  return {
    type: 'element',
    tag: 'stack',
    props: {
      className: 'todo-status-filter-panel',
      gap: 'sm',
      revealId: STATUS_FILTER_REVEAL_ID,
      ...(hiddenUntilRevealed ? { hiddenUntilRevealed: true } : {}),
    },
    children: [
      {
        type: 'element',
        tag: 'text',
        props: { className: 'todo-status-filter-label' },
        children: [{ type: 'text', value: 'Show Items' }],
      },
      {
        type: 'element',
        tag: 'row',
        props: { className: 'todo-status-filter-choices' },
        children: TODO_LIST_FILTER_STATUSES.map(
          ({ status, label }): WebNode => {
            const checked = selected.includes(status);
            const disabled = checked && selected.length === 1;

            return {
              type: 'element',
              tag: 'button',
              props: {
                label,
                className: `todo-status-filter-choice${checked ? ' is-selected' : ''}`,
                action: disabled
                  ? undefined
                  : toggleStatusFilterAction(representation, status),
              },
              children: statusOptionChildren(status, label),
            };
          },
        ),
      },
      {
        type: 'element',
        tag: 'row',
        props: { className: 'todo-status-filter-actions' },
        children: [
          {
            type: 'element',
            tag: 'button',
            props: {
              label: 'Close',
              className: 'web-button--link',
              action: hideInlineAddFormAction(STATUS_FILTER_REVEAL_ID),
            },
          },
        ],
      },
    ],
  };
}

function inlineAddRevealId(itemId: number, kind: 'child' | 'sibling'): string {
  return `todo-inline-add-${kind}-${itemId}`;
}

function inlineUpdateRevealId(itemId: number): string {
  return `todo-inline-update-${itemId}`;
}

function inlineMoveRevealId(itemId: number): string {
  return `todo-inline-move-${itemId}`;
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
      className:
        'web-form web-form--stacked web-form--ai-prompt todo-ai-prompt-form',
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

function toggleRevealAction(targetId: string): WebAction {
  return {
    type: 'toggleReveal',
    targetId,
  };
}

type BuildInlineTodoAddFormProps = {
  representation: ListRepresentation;
  revealId: string;
  underParentId: number | null;
  placeholder: string;
};

type BuildInlineTodoUpdateFormProps = {
  representation: ListRepresentation;
  item: ListItem;
};

type MoveDestinationChoices = {
  choices: string[];
  choiceLabels: Record<string, string>;
};

function descendantIdsForItem(
  representation: ListRepresentation,
  item: ListItem,
): Set<number> {
  const descendants = new Set<number>();
  const childrenByParentId = new Map<number, ListItem[]>();

  for (const row of representation.data.items) {
    if (row.parentId === null) {
      continue;
    }

    const children = childrenByParentId.get(row.parentId) ?? [];
    children.push(row);
    childrenByParentId.set(row.parentId, children);
  }

  const stack = [...(childrenByParentId.get(item.id) ?? [])];
  while (stack.length > 0) {
    const next = stack.pop();

    if (next === undefined || descendants.has(next.id)) {
      continue;
    }

    descendants.add(next.id);
    stack.push(...(childrenByParentId.get(next.id) ?? []));
  }

  return descendants;
}

function moveDestinationChoices(
  representation: ListRepresentation,
  item: ListItem,
): MoveDestinationChoices {
  const descendants = descendantIdsForItem(representation, item);
  const choices = [''];
  const choiceLabels: Record<string, string> = { '': 'Top level' };

  for (const row of representation.data.items) {
    if (row.id === item.id || descendants.has(row.id)) {
      continue;
    }

    const value = String(row.id);
    choices.push(value);

    choiceLabels[value] =
      `${'--'.repeat(row.depth)}${row.depth > 0 ? ' ' : ''}#${row.id} ${row.text}`;
  }

  return { choices, choiceLabels };
}

/** Inline widget form for `/… add`; `underParentId` is `--under` (omit when `null`, e.g. root sibling). */
function buildInlineTodoAddForm({
  representation,
  revealId,
  underParentId,
  placeholder,
}: BuildInlineTodoAddFormProps): WebNode {
  const refresh = listRefreshHighlightingCreatedTodo(
    representation,
    underParentId,
  );

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

function buildInlineTodoUpdateForm({
  representation,
  item,
}: BuildInlineTodoUpdateFormProps): WebNode {
  const revealId = inlineUpdateRevealId(item.id);

  return {
    type: 'element',
    tag: 'form',
    props: {
      className: 'web-form web-form--stacked todo-inline-add-form',
      revealId,
      hiddenUntilRevealed: true,
      action: {
        type: 'command',
        command: representation.meta.command,
        subcommand: 'update',
        arguments: { id: item.id, field: 'todo', value: '' },
        options: {},
        recordInTimeline: false,
        refresh: listRefreshHighlightingTodo(representation, item.id),
      },
    },
    children: [
      {
        type: 'element',
        tag: 'text',
        props: { tone: 'muted', size: 'sm' },
        children: [{ type: 'text', value: `Update #${item.id}` }],
      },
      {
        type: 'element',
        tag: 'textField',
        props: {
          formFieldName: 'value',
          inputPlaceholder: 'Todo title',
          value: item.text,
          autoFocus: true,
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
              label: 'Update',
              htmlType: 'submit',
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

function buildInlineTodoMoveForm(
  representation: ListRepresentation,
  item: ListItem,
): WebNode {
  const revealId = inlineMoveRevealId(item.id);
  const destinations = moveDestinationChoices(representation, item);

  return {
    type: 'element',
    tag: 'form',
    props: {
      className: 'web-form web-form--stacked todo-inline-add-form',
      revealId,
      hiddenUntilRevealed: true,
      formOptionFieldNames: ['under'],
      action: {
        type: 'command',
        command: representation.meta.command,
        subcommand: 'move',
        arguments: { id: item.id },
        options: {},
        recordInTimeline: false,
        refresh: listRefreshHighlightingMovedTodo(representation, item.id),
      },
    },
    children: [
      {
        type: 'element',
        tag: 'text',
        props: { tone: 'muted', size: 'sm' },
        children: [{ type: 'text', value: `Move #${item.id} under:` }],
      },
      {
        type: 'element',
        tag: 'select',
        props: {
          formFieldName: 'under',
          choices: destinations.choices,
          choiceLabels: destinations.choiceLabels,
          value: item.parentId === null ? '' : String(item.parentId),
          autoFocus: true,
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
              label: 'Move',
              htmlType: 'submit',
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
  const filtered = hasExplicitStatusFilter(representation);

  return {
    type: 'element',
    tag: 'stack',
    props: { gap: 'sm' },
    children: [
      {
        type: 'element',
        tag: 'text',
        props: { tone: 'muted' },
        children: [
          {
            type: 'text',
            value: filtered ? 'No todos matching filter.' : 'No todos yet.',
          },
        ],
      },
      ...(filtered
        ? []
        : [
            {
              type: 'element' as const,
              tag: 'button' as const,
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
          ]),
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

function scoreLabel(item: ListItem): string | undefined {
  return item.winRate === null ? 'unscored' : undefined;
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
    refresh:
      item.parentId === null
        ? listRefresh(representation)
        : listRefreshHighlightingTodo(representation, item.parentId),
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
  const returnRoot = representation.data.scope?.rootId ?? 'root';

  return {
    type: 'command',
    command: representation.meta.command,
    subcommand: 'duel',
    arguments: {
      parentId: item.id,
      duelArgs: ['web', 'choose', 'returnRoot', String(returnRoot)],
    },
    options: {},
    recordInTimeline: false,
  };
}

function copyToClipboardAction(text: string): WebAction {
  return {
    type: 'clientAction',
    action: 'clipboard.writeText',
    payload: { text },
  };
}

function todoItemVisibleSubtreeText(
  representation: ListRepresentation,
  item: ListItem,
): string {
  const startIndex = representation.data.items.findIndex(
    (candidate) => candidate.id === item.id,
  );

  if (startIndex < 0) {
    return `${TODO_TEXT_STATUS[item.status]} ${item.text} #${item.id}`;
  }

  const items = representation.data.items;
  const baseDepth = items[startIndex].depth;
  const lines: string[] = [];

  for (let index = startIndex; index < items.length; index += 1) {
    const current = items[index];

    if (index > startIndex && current.depth <= baseDepth) {
      break;
    }

    const relativeDepth = Math.max(0, current.depth - baseDepth);
    const indent = '  '.repeat(relativeDepth);
    const status = TODO_TEXT_STATUS[current.status] ?? '[ ]';

    lines.push(`${indent}${status} ${current.text} #${current.id}`);
  }

  return lines.join('\n');
}

function visibleTodoBoardText(representation: ListRepresentation): string {
  if (representation.data.items.length === 0) {
    return '';
  }

  const baseDepth = Math.min(
    ...representation.data.items.map((item) => item.depth),
  );

  return representation.data.items
    .map((item) => {
      const relativeDepth = Math.max(0, item.depth - baseDepth);
      const indent = '  '.repeat(relativeDepth);
      const status = TODO_TEXT_STATUS[item.status] ?? '[ ]';

      return `${indent}${status} ${item.text} #${item.id}`;
    })
    .join('\n');
}

function renderTodoRowActionsMenu(
  representation: ListRepresentation,
  item: ListItem,
): WebNode {
  const addChildRevealId = inlineAddRevealId(item.id, 'child');
  const addSiblingRevealId = inlineAddRevealId(item.id, 'sibling');

  return {
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
          label: `Copy #${item.id}`,
          action: copyToClipboardAction(`#${item.id}`),
        },
      },
      {
        type: 'element',
        tag: 'menuItem',
        props: {
          label: 'Copy as text',
          action: copyToClipboardAction(
            todoItemVisibleSubtreeText(representation, item),
          ),
        },
      },
      {
        type: 'element',
        tag: 'menuItem',
        props: {
          label: 'Update…',
          action: revealInlineAddFormAction(inlineUpdateRevealId(item.id)),
        },
      },
      {
        type: 'element',
        tag: 'menuItem',
        props: {
          label: 'Move…',
          action: revealInlineAddFormAction(inlineMoveRevealId(item.id)),
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
  };
}

function renderTodoItemRow(
  representation: ListRepresentation,
  item: ListItem,
): WebNode {
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
            label: scoreLabel(item),
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
          ...(item.status === 'pending'
            ? []
            : [
                {
                  type: 'element' as const,
                  tag: 'menuItem' as const,
                  props: {
                    label: 'Set as pending',
                    action: setTodoPendingAction(representation, item),
                  },
                  children: statusOptionChildren('pending', 'Pending'),
                },
              ]),
          ...(item.status === 'in_progress'
            ? []
            : [
                {
                  type: 'element' as const,
                  tag: 'menuItem' as const,
                  props: {
                    label: 'Set as in progress',
                    action: setTodoInProgressAction(representation, item),
                  },
                  children: statusOptionChildren('in_progress', 'In Progress'),
                },
              ]),
          ...(item.status === 'done'
            ? []
            : [
                {
                  type: 'element' as const,
                  tag: 'menuItem' as const,
                  props: {
                    label: 'Set as done',
                    action: setTodoDoneAction(representation, item),
                  },
                  children: statusOptionChildren('done', 'Done'),
                },
              ]),
        ],
      },
      {
        type: 'element',
        tag: 'stack',
        props: { className: 'todo-item-content' },
        children: mainChildren,
      },
      renderTodoRowActionsMenu(representation, item),
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
      defaultExpanded: false,
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
        buildInlineTodoUpdateForm({ representation, item }),
        buildInlineTodoMoveForm(representation, item),
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
      buildInlineTodoUpdateForm({ representation, item }),
      buildInlineTodoMoveForm(representation, item),
    ],
  };
}

export function renderListWeb(
  representation: ListRepresentation,
  _context: WebRenderContext,
): WebNodeRoot {
  const treeChildren: WebNode[] = [];

  if (representation.data.scope) {
    treeChildren.push(
      buildFocusedScopeWebNode({
        commandAlias: representation.meta.command,
        refresh: listRefresh(representation),
      }),
    );
  }

  treeChildren.push(
    buildStatusFilterPanel(
      representation,
      representation.data.view === 'tree' &&
        (representation.data.items.length > 0 ||
          !hasExplicitStatusFilter(representation)),
    ),
  );

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
          toolbarActions: [
            {
              label: 'Show items',
              icon: 'checklist',
              action: toggleRevealAction(STATUS_FILTER_REVEAL_ID),
            },
            {
              label: 'Copy visible board',
              icon: 'copy',
              action: copyToClipboardAction(
                visibleTodoBoardText(representation),
              ),
            },
          ],
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

  treeChildren.push(buildListAiCommandForm(representation));

  return {
    kind: 'ui',
    version: 1,
    meta: representation.meta,
    stylesheets: [todoListStylesheet],
    tree: {
      type: 'element',
      tag: 'stack',
      props: {
        className: 'todo-list-root',
        gap: 'md',
      },
      children: treeChildren,
    },
  };
}

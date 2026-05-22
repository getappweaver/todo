import type { StoryDefinition } from '@src/system/story-definition';

import {
  buildTodoListStoryCommandOutput,
  emptyTodoItems,
  type TodoStoryState,
} from '../../story-support';
import type { Todo } from '../../types/todos';

const addedRootTodo = {
  id: 104,
  parent_id: null,
  todo: 'Prepare live demo follow-up',
  status: 'pending',
  sort_order: 3,
  description: 'Turn the working storyboard into a guided product walkthrough.',
  tags: ['demo', 'launch'],
  source: 'demo',
  created_at: 1714003800,
  updated_at: 1714003800,
  completed_at: null,
} satisfies Todo;

const addedSiblingTodo = {
  id: 105,
  parent_id: null,
  todo: 'Schedule demo dry run',
  status: 'pending',
  sort_order: 4,
  description: 'Add a sibling item from the row action menu.',
  tags: ['demo', 'team'],
  source: 'demo',
  created_at: 1714003900,
  updated_at: 1714003900,
  completed_at: null,
} satisfies Todo;

const addedChildTodo = {
  id: 106,
  parent_id: addedRootTodo.id,
  todo: 'Share demo notes with the team',
  status: 'pending',
  sort_order: 1,
  description: 'Add a child item under the first story todo.',
  tags: ['demo', 'team'],
  source: 'demo',
  created_at: 1714004000,
  updated_at: 1714004000,
  completed_at: null,
} satisfies Todo;

export function buildAddStory(params: {
  prefix: string;
  alias: string;
}): StoryDefinition<TodoStoryState> {
  const finalItems = [addedRootTodo, addedChildTodo, addedSiblingTodo];

  const story: StoryDefinition<TodoStoryState> = {
    id: 'todo-add',
    title: 'Add a todo',
    description: 'Use the list widget native New flow to create a todo.',
    showcase: {
      title: 'Focused apps inside your workspace',
      description:
        'Open an installed Todo app, create structured data, and keep the workflow inside the same chat-native surface.',
      timing: { initialDelayMs: 900, stepDelayMs: 1800, storyDelayMs: 2400 },
    },
    kind: 'command',
    initialState: { chat: { messages: [] }, items: emptyTodoItems },
    sandbox: {
      todo: { items: emptyTodoItems, nextId: 104 },
      __outputs: {
        [`${params.alias}:list`]: [
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: emptyTodoItems,
          }).web,
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: [addedRootTodo],
          }).web,
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: [addedRootTodo, addedSiblingTodo],
          }).web,
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: finalItems,
          }).web,
        ],
        [`${params.alias}:add`]: [
          `Todo created: #${addedRootTodo.id}`,
          `Todo created: #${addedSiblingTodo.id}`,
          `Todo created: #${addedChildTodo.id}`,
        ],
      },
      __transitions: [
        {
          on: { command: params.alias, subcommand: 'add' },
          advanceOutputs: [
            { command: params.alias, subcommand: 'list' },
            { command: params.alias, subcommand: 'add' },
          ],
        },
      ],
    },
    steps: [
      {
        type: 'seed_sandbox',
        state: { todo: { items: emptyTodoItems, nextId: 104 } },
      },
      {
        type: 'instruction',
        text: 'Open the Todo widget from the header to create your first todo.',
        showcase: {
          title: 'Installed apps are always available',
          description:
            'Plugin commands can expose native widgets directly in the web UI.',
        },
      },
      {
        type: 'focus_target',
        target: {
          type: 'header_widget',
          command: params.alias,
          subcommand: 'list',
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'widget_opened',
          command: params.alias,
          subcommand: 'list',
        },
      },
      {
        type: 'instruction',
        text: 'Click New to open the widget-native add form.',
        showcase: {
          title: 'Commands can become interfaces',
          description:
            'The same command surface can render forms, actions, and rich outputs.',
        },
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-new-root' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-new-root' },
      },
      {
        type: 'fill_form',
        targetId: 'todo-add-text',
        showcase: {
          title: 'Type once, store it as app data',
          description:
            'The todo is created as structured plugin state, ready for follow-up actions.',
        },
        values: { arguments: { text: addedRootTodo.todo }, options: {} },
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-add-submit' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-add-submit' },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'command_completed',
          command: params.alias,
          subcommand: 'list',
        },
      },
      {
        type: 'instruction',
        text: 'Hover the todo row to reveal its row actions.',
        showcase: {
          title: 'Structured data stays interactive',
          description:
            'Outputs are not screenshots. They remain live app surfaces with follow-up actions.',
        },
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: `todo-row-${addedRootTodo.id}` },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_hovered',
          targetId: `todo-row-${addedRootTodo.id}`,
        },
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: `todo-row-actions-${addedRootTodo.id}`,
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: `todo-row-actions-${addedRootTodo.id}`,
        },
      },
      {
        type: 'instruction',
        text: 'Click Add sibling to open another inline add form.',
        showcase: {
          title: 'Keep related work grouped together',
          description:
            'Sibling items make it easy to grow a small checklist from one starting point.',
        },
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: `todo-add-sibling-${addedRootTodo.id}`,
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: `todo-add-sibling-${addedRootTodo.id}`,
        },
      },
      {
        type: 'fill_form',
        targetId: 'todo-add-text',
        values: { arguments: { text: addedSiblingTodo.todo }, options: {} },
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-add-submit' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-add-submit' },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'command_completed',
          command: params.alias,
          subcommand: 'list',
        },
      },
      {
        type: 'instruction',
        text: 'Hover the parent todo row again to add a child item.',
        showcase: {
          title: 'Nested workflows are first-class',
          description:
            'Todos can become trees, so plans can carry subtasks where they belong.',
        },
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: `todo-row-${addedRootTodo.id}` },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_hovered',
          targetId: `todo-row-${addedRootTodo.id}`,
        },
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: `todo-row-actions-${addedRootTodo.id}`,
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: `todo-row-actions-${addedRootTodo.id}`,
        },
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: `todo-add-child-${addedRootTodo.id}`,
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: `todo-add-child-${addedRootTodo.id}`,
        },
      },
      {
        type: 'fill_form',
        targetId: 'todo-add-text',
        values: { arguments: { text: addedChildTodo.todo }, options: {} },
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-add-submit' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-add-submit' },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'command_completed',
          command: params.alias,
          subcommand: 'list',
        },
      },
      {
        type: 'complete',
        cleanup: {
          closeWidgets: [{ command: params.alias, subcommand: 'list' }],
        },
      },
    ],
  };

  story.commandOutput = buildTodoListStoryCommandOutput({
    prefix: params.prefix,
    alias: params.alias,
    items: finalItems,
  });

  return story;
}

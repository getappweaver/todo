import type { StoryDefinition } from '@src/system/story-definition';

import {
  buildTodoListStoryCommandOutput,
  type TodoStoryState,
} from '../../story-support';
import type { Todo } from '../../types/todos';

const addStoryListOptions = { __storySkipPrioritizeRefresh: true };

const taskA = {
  id: 101,
  parent_id: null,
  todo: 'Launch Readiness',
  status: 'pending',
  sort_order: 1,
  description: null,
  tags: ['launch'],
  source: 'demo',
  created_at: 1714003800,
  updated_at: 1714003800,
  completed_at: null,
} satisfies Todo;

const subtaskA1 = {
  id: 102,
  parent_id: taskA.id,
  todo: 'Finalize release checklist',
  status: 'pending',
  sort_order: 1,
  description: null,
  tags: ['checklist'],
  source: 'demo',
  created_at: 1714003850,
  updated_at: 1714003850,
  completed_at: null,
} satisfies Todo;

const subtaskA2 = {
  id: 103,
  parent_id: taskA.id,
  todo: 'Verify backup restore',
  status: 'pending',
  sort_order: 2,
  description: null,
  tags: ['ops'],
  source: 'demo',
  created_at: 1714003900,
  updated_at: 1714003900,
  completed_at: null,
} satisfies Todo;

const taskB = {
  id: 104,
  parent_id: null,
  todo: 'Core Architecture',
  status: 'pending',
  sort_order: 2,
  description: null,
  tags: ['core'],
  source: 'demo',
  created_at: 1714003950,
  updated_at: 1714003950,
  completed_at: null,
} satisfies Todo;

const subtaskB1 = {
  id: 105,
  parent_id: taskB.id,
  todo: 'Plugin sandbox isolation',
  status: 'pending',
  sort_order: 1,
  description: null,
  tags: ['security'],
  source: 'demo',
  created_at: 1714004000,
  updated_at: 1714004000,
  completed_at: null,
} satisfies Todo;

const subtaskB1_1 = {
  id: 106,
  parent_id: subtaskB1.id,
  todo: 'Strict schema validation',
  status: 'pending',
  sort_order: 1,
  description: null,
  tags: ['types'],
  source: 'demo',
  created_at: 1714004050,
  updated_at: 1714004050,
  completed_at: null,
} satisfies Todo;

const subtaskB2 = {
  id: 107,
  parent_id: taskB.id,
  todo: 'Offline sync queue',
  status: 'pending',
  sort_order: 2,
  description: null,
  tags: ['sync'],
  source: 'demo',
  created_at: 1714004100,
  updated_at: 1714004100,
  completed_at: null,
} satisfies Todo;

const addedSubtaskB1_2 = {
  id: 108,
  parent_id: subtaskB1.id,
  todo: 'Verify permission boundaries',
  status: 'pending',
  sort_order: 2,
  description: null,
  tags: ['security'],
  source: 'demo',
  created_at: 1714004200,
  updated_at: 1714004200,
  completed_at: null,
} satisfies Todo;

const initialNestedItems = [
  taskA,
  subtaskA1,
  subtaskA2,
  taskB,
  subtaskB1,
  subtaskB1_1,
  subtaskB2,
];

const finalNestedItems = [
  taskA,
  subtaskA1,
  subtaskA2,
  taskB,
  subtaskB1,
  subtaskB1_1,
  addedSubtaskB1_2,
  subtaskB2,
];

export function buildAddStory(params: {
  prefix: string;
  alias: string;
}): StoryDefinition<TodoStoryState> {
  const story: StoryDefinition<TodoStoryState> = {
    id: 'todo-add',
    title: 'Organize nested tasks',
    description: 'Structure your work.\nDepth without clutter.',
    showcase: {
      title: 'Structure your work.\nDepth without clutter.',
      description:
        'Organize subtasks under **any parent**.\nFocus or flatten on your *own terms*',
      timing: { initialDelayMs: 900, stepDelayMs: 1800, storyDelayMs: 2400 },
    },
    kind: 'command',
    initialState: { chat: { messages: [] }, items: initialNestedItems },
    sandbox: {
      todo: { items: initialNestedItems, nextId: 108 },
      __outputs: {
        [`${params.alias}:list`]: [
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: initialNestedItems,
            listOptions: addStoryListOptions,
          }).web,
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: finalNestedItems,
            listOptions: addStoryListOptions,
          }).web,
        ],
        [`${params.alias}:add`]: [`Todo created: #${addedSubtaskB1_2.id}`],
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
        state: { todo: { items: initialNestedItems, nextId: 108 } },
      },
      {
        type: 'instruction',
        text: 'Open the Todo widget from the header to inspect your task tree.',
        showcase: {
          title: 'Todo app has a header button as a shortcut.',
          description:
            'The Todo plugin list command exposes a web widget button in the header.',
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
        text: 'Hover Subtask B1 to reveal its row actions.',
        showcase: {
          title: 'Hover the todo row to reveal its row actions.',
          description: 'Row actions let you add child or sibling tasks.',
        },
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: `todo-row-${subtaskB1.id}` },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_hovered',
          targetId: `todo-row-${subtaskB1.id}`,
        },
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: `todo-row-actions-${subtaskB1.id}`,
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: `todo-row-actions-${subtaskB1.id}`,
        },
      },
      {
        type: 'instruction',
        text: 'Click Add child to add a subtask.',
        showcase: {
          title: 'Add a child item under any parent',
          description: 'Structure tasks into as many levels as needed.',
        },
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: `todo-add-child-${subtaskB1.id}`,
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: `todo-add-child-${subtaskB1.id}`,
        },
      },
      {
        type: 'fill_form',
        targetId: 'todo-add-text',
        showcase: {
          title: 'Type the title of the subtask.',
          description: 'What needs to be done?',
        },
        values: { arguments: { text: addedSubtaskB1_2.todo }, options: {} },
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
    items: finalNestedItems,
    listOptions: addStoryListOptions,
  });

  return story;
}

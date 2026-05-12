import type {
  StoryChatState,
  StoryDefinition,
} from '@src/system/story-definition';
import type { WebAction, WebNodeRoot } from '@src/web/ui-schema';
import { draftReviewPrompt } from '@src/web/widgets';

import { renderListWeb } from './commands/list/renderers/web';
import { createListRepresentation } from './commands/list/representation/builder';
import type { Todo } from './types/todos';

type TodoStoryState = {
  chat: StoryChatState;
  items: Todo[];
};

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

const emptyItems = [] satisfies Todo[];

const duelParentTodo = {
  id: 301,
  parent_id: null,
  todo: 'Launch mobile landing demo',
  status: 'pending',
  sort_order: 1,
  description: 'Use duel to rank the next demo polish tasks.',
  tags: ['demo', 'mobile'],
  source: 'demo',
  created_at: 1714005000,
  updated_at: 1714005000,
  completed_at: null,
} satisfies Todo;

const duelTodoA = {
  id: 302,
  parent_id: duelParentTodo.id,
  todo: 'Polish mobile hero layout',
  status: 'pending',
  sort_order: 1,
  description: 'Make the first screen feel intentional on small devices.',
  tags: ['demo', 'mobile'],
  source: 'demo',
  created_at: 1714005100,
  updated_at: 1714005100,
  completed_at: null,
} satisfies Todo;

const duelTodoB = {
  id: 303,
  parent_id: duelParentTodo.id,
  todo: 'Record story playback states',
  status: 'pending',
  sort_order: 2,
  description: 'Check play, pause, rewind, and next controls in the app demo.',
  tags: ['demo', 'stories'],
  source: 'demo',
  created_at: 1714005200,
  updated_at: 1714005200,
  completed_at: null,
} satisfies Todo;

const duelTodoC = {
  id: 304,
  parent_id: duelParentTodo.id,
  todo: 'Verify install flow copy',
  status: 'pending',
  sort_order: 3,
  description: 'Ensure the landing page explains plugin installation clearly.',
  tags: ['demo', 'copy'],
  source: 'demo',
  created_at: 1714005300,
  updated_at: 1714005300,
  completed_at: null,
} satisfies Todo;

const duelItems = [
  duelParentTodo,
  duelTodoC,
  duelTodoA,
  duelTodoB,
] satisfies Todo[];

const duelRankedItems = [
  duelParentTodo,
  {
    ...duelTodoA,
    sort_order: 1,
  },
  {
    ...duelTodoB,
    sort_order: 2,
  },
  {
    ...duelTodoC,
    sort_order: 3,
  },
] satisfies Todo[];

function buildTodoListStoryCommandOutput(params: {
  prefix: string;
  alias: string;
  items: Todo[];
}): NonNullable<StoryDefinition<TodoStoryState>['commandOutput']> {
  const itemsById = new Map(params.items.map((item) => [item.id, item]));

  const representation = createListRepresentation({
    command: params.alias,
    subcommand: 'list',
    scope: null,
    view: 'tree',
    showDescriptions: false,
    listInvocation: {
      arguments: {},
      options: {},
    },
    items: params.items.map((item) => {
      let depth = 0;
      let parentId = item.parent_id;

      while (parentId !== null) {
        depth += 1;
        parentId = itemsById.get(parentId)?.parent_id ?? null;
      }

      return {
        id: item.id,
        parentId: item.parent_id,
        text: item.todo,
        status: item.status,
        description: item.description,
        depth,
        wins: 0,
        losses: 0,
        winRate: null,
      };
    }),
  });

  return {
    text: null,
    web: renderListWeb(representation, { prefix: params.prefix }),
    clientView: null,
  };
}

function buildAddStory(params: {
  prefix: string;
  alias: string;
}): StoryDefinition<TodoStoryState> {
  const story: StoryDefinition<TodoStoryState> = {
    id: 'todo-add',
    title: 'Add a todo',
    description: 'Use the list widget native New flow to create a todo.',
    showcase: {
      title: 'Focused apps inside your workspace',
      description:
        'Open an installed Todo app, create structured data, and keep the workflow inside the same chat-native surface.',
      timing: {
        initialDelayMs: 900,
        stepDelayMs: 1800,
        storyDelayMs: 2400,
      },
    },
    kind: 'command',
    initialState: {
      chat: { messages: [] },
      items: emptyItems,
    },
    sandbox: {
      todo: {
        items: emptyItems,
        nextId: 104,
      },
      __outputs: {
        [`${params.alias}:list`]: [
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: emptyItems,
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
            items: [addedRootTodo, addedChildTodo, addedSiblingTodo],
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
        state: {
          todo: {
            items: emptyItems,
            nextId: 104,
          },
        },
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
        target: {
          type: 'web_node',
          targetId: 'todo-new-root',
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: 'todo-new-root',
        },
      },
      {
        type: 'instruction',
        text: 'Click to fill the todo title.',
      },
      {
        type: 'fill_form',
        targetId: 'todo-add-text',
        showcase: {
          title: 'Type once, store it as app data',
          description:
            'The todo is created as structured plugin state, ready for follow-up actions.',
        },
        values: {
          arguments: { text: addedRootTodo.todo },
          options: {},
        },
      },
      {
        type: 'instruction',
        text: 'Click Add to create the todo.',
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: 'todo-add-submit',
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: 'todo-add-submit',
        },
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
        target: {
          type: 'web_node',
          targetId: `todo-row-${addedRootTodo.id}`,
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_hovered',
          targetId: `todo-row-${addedRootTodo.id}`,
        },
      },
      {
        type: 'instruction',
        text: 'Click the row actions menu.',
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
        type: 'instruction',
        text: 'Click to fill the sibling todo title.',
      },
      {
        type: 'fill_form',
        targetId: 'todo-add-text',
        showcase: {
          title: 'Keep related work grouped together',
          description:
            'Sibling items make it easy to grow a small checklist from one starting point.',
        },
        values: {
          arguments: { text: addedSiblingTodo.todo },
          options: {},
        },
      },
      {
        type: 'instruction',
        text: 'Click Add to create the sibling todo.',
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: 'todo-add-submit',
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: 'todo-add-submit',
        },
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
        target: {
          type: 'web_node',
          targetId: `todo-row-${addedRootTodo.id}`,
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_hovered',
          targetId: `todo-row-${addedRootTodo.id}`,
        },
      },
      {
        type: 'instruction',
        text: 'Click the row actions menu again.',
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
        text: 'Click Add child to open an inline child form.',
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
        type: 'instruction',
        text: 'Click to fill the child todo title.',
      },
      {
        type: 'fill_form',
        targetId: 'todo-add-text',
        showcase: {
          title: 'Capture the next concrete step',
          description:
            'Child todos keep implementation details attached to the larger task.',
        },
        values: {
          arguments: { text: addedChildTodo.todo },
          options: {},
        },
      },
      {
        type: 'instruction',
        text: 'Click Add to create the child todo.',
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: 'todo-add-submit',
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: 'todo-add-submit',
        },
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
          closeWidgets: [
            {
              command: params.alias,
              subcommand: 'list',
            },
          ],
        },
      },
    ],
  };

  story.commandOutput = buildTodoListStoryCommandOutput({
    prefix: params.prefix,
    alias: params.alias,
    items: [addedRootTodo, addedChildTodo, addedSiblingTodo],
  });

  return story;
}

const aiPromptText =
  'Create follow-up tasks for a live AppWeaver demo: prepare notes, schedule a dry run, and send the recap.';

const aiPromptItems = [
  {
    id: 201,
    parent_id: null,
    todo: 'Prepare launch checklist',
    status: 'pending',
    sort_order: 1,
    description: null,
    tags: [],
    source: 'demo',
    created_at: 1714004050,
    updated_at: 1714004050,
    completed_at: null,
  },
  {
    id: 202,
    parent_id: null,
    todo: 'Prepare live demo notes',
    status: 'pending',
    sort_order: 2,
    description: 'AI-created root item from the todo prompt workflow.',
    tags: ['ai', 'demo'],
    source: 'demo',
    created_at: 1714004100,
    updated_at: 1714004100,
    completed_at: null,
  },
  {
    id: 203,
    parent_id: 202,
    todo: 'Schedule demo dry run',
    status: 'pending',
    sort_order: 1,
    description: 'Child item created under the demo notes task.',
    tags: ['ai', 'demo'],
    source: 'demo',
    created_at: 1714004200,
    updated_at: 1714004200,
    completed_at: null,
  },
  {
    id: 204,
    parent_id: null,
    todo: 'Send demo recap to the team',
    status: 'pending',
    sort_order: 3,
    description: 'AI-created root item from the todo prompt workflow.',
    tags: ['ai', 'team'],
    source: 'demo',
    created_at: 1714004300,
    updated_at: 1714004300,
    completed_at: null,
  },
] satisfies Todo[];

const aiDraftReviewText = `AI drafted these todos:

- Prepare launch checklist
- Prepare live demo notes
  AI-created root item from the todo prompt workflow.
  tags: ai, demo
  - Schedule demo dry run
    Child item created under the demo notes task.
    tags: ai, demo
- Send demo recap to the team
  AI-created root item from the todo prompt workflow.
  tags: ai, team

a=accept, r=revise, d=decline, s=skip, q=quit`;

function buildAiPromptStory(params: {
  prefix: string;
  alias: string;
}): StoryDefinition<TodoStoryState> {
  const story: StoryDefinition<TodoStoryState> = {
    id: 'todo-add-ai-prompt',
    title: 'Todo add via AI prompt',
    description:
      'Use the Todo widget AI prompt to create several todos at once.',
    showcase: {
      title: 'AI drafts actions before changing data',
      description:
        'Ask in natural language, inspect the proposed app changes, then accept only when the draft looks right.',
      timing: {
        initialDelayMs: 900,
        stepDelayMs: 2100,
        storyDelayMs: 2800,
      },
    },
    kind: 'ai',
    initialState: {
      chat: { messages: [] },
      items: emptyItems,
    },
    sandbox: {
      todo: {
        items: emptyItems,
        nextId: 201,
      },
      __outputs: {
        [`${params.alias}:list`]: [
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: emptyItems,
          }).web,
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: aiPromptItems,
          }).web,
        ],
      },
      __prompts: {
        [`${params.alias}:ai`]: {
          type: 'web-prompt',
          value: draftReviewPrompt({
            command: params.alias,
            subcommand: 'ai',
            body: aiDraftReviewText,
          }),
        },
      },
      __transitions: [
        {
          on: { command: params.alias, subcommand: 'ai' },
          answer: 'a',
          advanceOutput: { command: params.alias, subcommand: 'list' },
        },
      ],
    },
    steps: [
      {
        type: 'seed_sandbox',
        state: {
          todo: {
            items: emptyItems,
            nextId: 201,
          },
        },
      },
      {
        type: 'instruction',
        text: 'Open the Todo widget from the header to use its AI prompt.',
        showcase: {
          title: 'AI lives next to the app',
          description:
            'Plugins can provide focused AI flows that know their own data model.',
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
        text: 'Click Fill to fill the AI prompt for me.',
      },
      {
        type: 'fill_form',
        targetId: 'todo-ai-prompt-text',
        showcase: {
          title: 'Write here and let AI draft items for you',
          description:
            'Describe the outcome in natural language while the plugin handles the app-specific shape.',
        },
        values: {
          arguments: { prompt: aiPromptText },
          options: {},
        },
      },
      {
        type: 'instruction',
        text: 'Click Run AI to generate the todos.',
        showcase: {
          title: 'Agents can prepare app-native changes',
          description:
            'The model proposes changes through the plugin instead of directly mutating state.',
          delayMs: 1500,
        },
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: 'todo-ai-prompt-submit',
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: 'todo-ai-prompt-submit',
        },
      },
      {
        type: 'instruction',
        text: 'Click Accept on the draft review to create the todos.',
        showcase: {
          title: 'Draft items can be accepted or revised',
          description:
            'Review the AI proposal, accept it when it is right, or revise before anything is written.',
        },
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: 'draft-review-accept',
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: 'draft-review-accept',
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'command_completed',
          command: params.alias,
          subcommand: 'ai',
        },
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
          closeWidgets: [
            {
              command: params.alias,
              subcommand: 'list',
            },
          ],
        },
      },
    ],
  };

  story.commandOutput = buildTodoListStoryCommandOutput({
    prefix: params.prefix,
    alias: params.alias,
    items: aiPromptItems,
  });

  return story;
}

function duelStoryAction(params: {
  alias: string;
  actionArgs: string[];
}): WebAction {
  return {
    type: 'command',
    command: params.alias,
    subcommand: 'duel',
    arguments: {
      parentId: duelParentTodo.id,
      duelArgs: ['web', ...params.actionArgs, 'returnRoot', 'root'],
    },
    options: {},
    recordInTimeline: false,
  };
}

function buildDuelQuestionStoryOutput(params: {
  alias: string;
  question: string;
  a: Todo;
  b: Todo;
}): WebNodeRoot {
  return {
    kind: 'ui',
    version: 1,
    meta: {
      command: params.alias,
      subcommand: 'duel',
      arguments: { parentId: duelParentTodo.id, duelArgs: ['web'] },
    },
    tree: {
      type: 'element',
      tag: 'box',
      props: { padding: 'md', scrollIntoViewOnMount: true },
      children: [
        {
          type: 'element',
          tag: 'stack',
          props: { gap: 'md' },
          children: [
            {
              type: 'element',
              tag: 'text',
              props: { weight: 'bold' },
              children: [{ type: 'text', value: params.question }],
            },
            ...[
              {
                label: 'A',
                item: params.a,
                other: params.b,
                targetId: 'todo-duel-answer-A',
              },
              {
                label: 'B',
                item: params.b,
                other: params.a,
                targetId: 'todo-duel-answer-B',
              },
            ].map(({ label, item, other, targetId }) => ({
              type: 'element' as const,
              tag: 'row' as const,
              props: { itemAlign: 'start', className: 'todo-duel-card-row' },
              children: [
                {
                  type: 'element' as const,
                  tag: 'button' as const,
                  props: {
                    label,
                    storyTargetId: targetId,
                    action: duelStoryAction({
                      alias: params.alias,
                      actionArgs: ['answer', String(item.id), String(other.id)],
                    }),
                  },
                },
                {
                  type: 'element' as const,
                  tag: 'text' as const,
                  props: { weight: 'bold' as const },
                  children: [{ type: 'text' as const, value: item.todo }],
                },
              ],
            })),
          ],
        },
      ],
    },
  };
}

function buildDuelCompleteStoryOutput(params: { alias: string }): WebNodeRoot {
  return {
    kind: 'ui',
    version: 1,
    meta: {
      command: params.alias,
      subcommand: 'duel',
      arguments: { parentId: duelParentTodo.id, duelArgs: ['web'] },
    },
    tree: {
      type: 'element',
      tag: 'box',
      props: { padding: 'md', scrollIntoViewOnMount: true },
      children: [
        {
          type: 'element',
          tag: 'stack',
          props: { gap: 'md' },
          children: [
            {
              type: 'element',
              tag: 'text',
              props: { weight: 'bold' },
              children: [
                { type: 'text', value: 'All items in this scope are scored.' },
              ],
            },
            {
              type: 'element',
              tag: 'button',
              props: {
                label: 'Done',
                storyTargetId: 'todo-duel-done',
                action: duelStoryAction({
                  alias: params.alias,
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
                action: duelStoryAction({
                  alias: params.alias,
                  actionArgs: ['reset'],
                }),
              },
            },
          ],
        },
      ],
    },
  };
}

function buildDuelStory(params: {
  prefix: string;
  alias: string;
}): StoryDefinition<TodoStoryState> {
  const story: StoryDefinition<TodoStoryState> = {
    id: 'todo-duel-prioritize',
    title: 'Prioritize todos with duel',
    description:
      'Use the Todo duel widget to rank sibling tasks through interactive pairwise choices.',
    showcase: {
      title: 'Interactive widgets can guide app workflows',
      description:
        'Duel asks simple A/B questions, records comparisons, and turns a flat task list into a ranked priority order.',
      timing: {
        initialDelayMs: 900,
        stepDelayMs: 1900,
        storyDelayMs: 2600,
      },
    },
    kind: 'command',
    initialState: {
      chat: { messages: [] },
      items: duelItems,
    },
    sandbox: {
      todo: {
        items: duelItems,
        nextId: 305,
      },
      __outputs: {
        [`${params.alias}:list`]: [
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: duelItems,
          }).web,
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: duelRankedItems,
          }).web,
        ],
        [`${params.alias}:duel`]: [
          buildDuelQuestionStoryOutput({
            alias: params.alias,
            question: 'Question 1 of 3: which is more important?',
            a: duelTodoA,
            b: duelTodoB,
          }),
          buildDuelQuestionStoryOutput({
            alias: params.alias,
            question: 'Question 2 of 3: which is more important?',
            a: duelTodoA,
            b: duelTodoC,
          }),
          buildDuelQuestionStoryOutput({
            alias: params.alias,
            question: 'Question 3 of 3: which is more important?',
            a: duelTodoB,
            b: duelTodoC,
          }),
          buildDuelCompleteStoryOutput({
            alias: params.alias,
          }),
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: duelRankedItems,
          }).web,
        ],
      },
      __transitions: [
        {
          on: { command: params.alias, subcommand: 'duel' },
          advanceOutput: { command: params.alias, subcommand: 'duel' },
        },
      ],
    },
    steps: [
      {
        type: 'seed_sandbox',
        state: {
          todo: {
            items: duelItems,
            nextId: 305,
          },
        },
      },
      {
        type: 'instruction',
        text: 'Open the Todo widget from the header to rank sibling tasks.',
        showcase: {
          title: 'Todo can ask focused interactive questions',
          description:
            'The duel command compares sibling tasks one pair at a time instead of asking you to sort the whole list manually.',
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
        text: 'Hover the parent row to reveal its row actions.',
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: `todo-row-${duelParentTodo.id}`,
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_hovered',
          targetId: `todo-row-${duelParentTodo.id}`,
        },
      },
      {
        type: 'instruction',
        text: 'Open the row action menu.',
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: `todo-row-actions-${duelParentTodo.id}`,
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: `todo-row-actions-${duelParentTodo.id}`,
        },
      },
      {
        type: 'instruction',
        text: 'Click Duel to start pairwise ranking for the child tasks.',
        showcase: {
          title: 'Commands can update in place for structured input',
          description:
            'The widget replaces itself after each A/B choice so the ranking flow stays in one card.',
        },
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: `todo-duel-${duelParentTodo.id}`,
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: `todo-duel-${duelParentTodo.id}`,
        },
      },
      {
        type: 'instruction',
        text: 'Choose A for the first comparison.',
        showcase: {
          title: 'Each answer records one comparison',
          description:
            'Simple A/B choices are enough for the plugin to build a ranking graph.',
        },
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-duel-answer-A' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-duel-answer-A' },
      },
      {
        type: 'instruction',
        text: 'Choose A again for the second comparison.',
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-duel-answer-A' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-duel-answer-A' },
      },
      {
        type: 'instruction',
        text: 'Choose A for the final comparison.',
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-duel-answer-A' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-duel-answer-A' },
      },
      {
        type: 'instruction',
        text: 'Click Done to return to the ranked todo list.',
        showcase: {
          title: 'Duel returns to the regular list',
          description:
            'When the ranking is complete, Done closes the duel view and shows the updated order.',
        },
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-duel-done' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-duel-done' },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'command_completed',
          command: params.alias,
          subcommand: 'duel',
        },
      },
      {
        type: 'complete',
        cleanup: {
          closeWidgets: [
            {
              command: params.alias,
              subcommand: 'list',
            },
          ],
        },
      },
    ],
  };

  story.commandOutput = buildTodoListStoryCommandOutput({
    prefix: params.prefix,
    alias: params.alias,
    items: duelRankedItems,
  });

  return story;
}

export function todoStories(
  prefix: string,
  alias: string,
): StoryDefinition<unknown>[] {
  return [
    buildAddStory({ prefix, alias }),
    buildAiPromptStory({ prefix, alias }),
    buildDuelStory({ prefix, alias }),
  ];
}

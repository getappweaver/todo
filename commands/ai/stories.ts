import type { StoryDefinition } from '@src/system/story-definition';
import { draftReviewPrompt } from '@src/web/widgets';

import {
  buildTodoListStoryCommandOutput,
  emptyTodoItems,
  type TodoStoryState,
} from '../../story-support';
import type { Todo } from '../../types/todos';

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

export function buildAiPromptStory(params: {
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
      timing: { initialDelayMs: 900, stepDelayMs: 2100, storyDelayMs: 2800 },
    },
    kind: 'ai',
    initialState: { chat: { messages: [] }, items: emptyTodoItems },
    sandbox: {
      todo: { items: emptyTodoItems, nextId: 201 },
      __outputs: {
        [`${params.alias}:list`]: [
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: emptyTodoItems,
            listOptions: {},
          }).web,
          buildTodoListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: aiPromptItems,
            listOptions: {},
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
        state: { todo: { items: emptyTodoItems, nextId: 201 } },
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
        type: 'fill_form',
        targetId: 'todo-ai-prompt-text',
        showcase: {
          title: 'Write here and let AI draft items for you',
          description:
            'Describe the outcome in natural language while the plugin handles the app-specific shape.',
        },
        values: { arguments: { prompt: aiPromptText }, options: {} },
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
        target: { type: 'web_node', targetId: 'todo-ai-prompt-submit' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-ai-prompt-submit' },
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
        target: { type: 'web_node', targetId: 'draft-review-accept' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'draft-review-accept' },
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
          closeWidgets: [{ command: params.alias, subcommand: 'list' }],
        },
      },
    ],
  };

  story.commandOutput = buildTodoListStoryCommandOutput({
    prefix: params.prefix,
    alias: params.alias,
    items: aiPromptItems,
    listOptions: {},
  });

  return story;
}

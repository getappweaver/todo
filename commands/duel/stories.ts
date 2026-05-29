import type { StoryDefinition } from '@src/system/story-definition';
import type { WebAction, WebNodeRoot } from '@src/web/ui-schema';

import {
  buildTodoListStoryCommandOutput,
  type TodoStoryState,
} from '../../story-support';
import type { Todo, TodoWithWinStats } from '../../types/todos';

import {
  renderChampionQuestion,
  renderDuelQuestion,
  type DuelButton,
  type DuelTodoItem,
} from './component';

const duelSiblingRootTodo = {
  id: 300,
  parent_id: null,
  todo: 'Ship desktop dashboard polish',
  status: 'pending',
  sort_order: 0,
  description:
    'A second root item so the duel command can offer sibling scope.',
  tags: ['demo', 'desktop'],
  source: 'demo',
  created_at: 1714004900,
  updated_at: 1714004900,
  completed_at: null,
} satisfies Todo;

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
  duelSiblingRootTodo,
  duelParentTodo,
  duelTodoC,
  duelTodoA,
  duelTodoB,
] satisfies Todo[];

const duelRankedItems = [
  { ...duelSiblingRootTodo, wins: 0, losses: 0, win_rate: null },
  { ...duelParentTodo, wins: 0, losses: 0, win_rate: null },
  { ...duelTodoA, sort_order: 1, wins: 2, losses: 0, win_rate: 1 },
  { ...duelTodoB, sort_order: 2, wins: 1, losses: 1, win_rate: 0.5 },
  { ...duelTodoC, sort_order: 3, wins: 0, losses: 2, win_rate: 0 },
] satisfies TodoWithWinStats[];

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

function toDuelStoryItem(item: Todo): DuelTodoItem {
  return {
    id: item.id,
    todo: item.todo,
    status: item.status,
    hasChampion: item.id === duelParentTodo.id,
    selectedChampion: item.id === duelTodoA.id,
    children: duelItems
      .filter((child) => child.parent_id === item.id)
      .map(toDuelStoryItem),
  };
}

function duelStoryButton(params: {
  label: string;
  action: WebAction;
  className: string | null;
  storyTargetId: string | null;
}): DuelButton {
  return params;
}

function buildDuelQuestionStoryOutput(params: {
  alias: string;
  questionIndex: number;
  question: string;
  a: Todo;
  b: Todo;
}): WebNodeRoot {
  const answerATargetId = `todo-duel-answer-${params.questionIndex}-A`;
  const answerBTargetId = `todo-duel-answer-${params.questionIndex}-B`;

  return renderDuelQuestion({
    commandAlias: params.alias,
    parentId: duelParentTodo.id,
    title: duelParentTodo.todo,
    notice: null,
    question: params.question,
    a: {
      label: 'A',
      item: toDuelStoryItem(params.a),
      storyTargetId: answerATargetId,
      action: duelStoryAction({
        alias: params.alias,
        actionArgs: [
          'prioritizeAnswer',
          String(params.a.id),
          String(params.b.id),
          'story-root-scope-hash',
          'prioritizeRoot',
          'root',
        ],
      }),
    },
    b: {
      label: 'B',
      item: toDuelStoryItem(params.b),
      storyTargetId: answerBTargetId,
      action: duelStoryAction({
        alias: params.alias,
        actionArgs: [
          'prioritizeAnswer',
          String(params.b.id),
          String(params.a.id),
          'story-root-scope-hash',
          'prioritizeRoot',
          'root',
        ],
      }),
    },
    actions: [
      duelStoryButton({
        label: 'Skip',
        className: null,
        storyTargetId: null,
        action: duelStoryAction({
          alias: params.alias,
          actionArgs: [
            'prioritizeDuelSkip',
            String(params.a.id),
            String(params.b.id),
            'story-root-scope-hash',
            'prioritizeRoot',
            'root',
          ],
        }),
      }),
      duelStoryButton({
        label: 'Quit',
        className: null,
        storyTargetId: null,
        action: duelStoryAction({ alias: params.alias, actionArgs: ['quit'] }),
      }),
    ],
    remaining: duelItems
      .filter(
        (item) =>
          item.parent_id === duelParentTodo.id &&
          item.id !== params.a.id &&
          item.id !== params.b.id,
      )
      .map(toDuelStoryItem),
  });
}

function buildChampionPickStoryOutput(params: { alias: string }): WebNodeRoot {
  return renderChampionQuestion({
    commandAlias: params.alias,
    parentId: duelParentTodo.id,
    title: duelParentTodo.todo,
    notice: null,
    context: {
      parentPath: [duelParentTodo.todo],
      currentParentId: duelParentTodo.id,
      rootItems: [duelSiblingRootTodo, duelParentTodo].map(toDuelStoryItem),
      defaultExpandedIds: [duelParentTodo.id],
    },
    choices: [duelTodoA, duelTodoB, duelTodoC].map((item, index) => ({
      item: toDuelStoryItem(item),
      storyTargetId: `todo-champion-pick-${index + 1}`,
      action: duelStoryAction({
        alias: params.alias,
        actionArgs: [
          'prioritizePick',
          String(item.id),
          'story-scope-hash',
          'prioritizeRoot',
          'root',
        ],
      }),
    })),
    actions: [
      duelStoryButton({
        label: 'Quit',
        className: null,
        storyTargetId: null,
        action: duelStoryAction({ alias: params.alias, actionArgs: ['quit'] }),
      }),
    ],
  });
}

export function buildDuelStory(params: {
  prefix: string;
  alias: string;
}): StoryDefinition<TodoStoryState> {
  const story: StoryDefinition<TodoStoryState> = {
    id: 'todo-duel-prioritize',
    title: 'Prioritize todos',
    description:
      'Use the Todo prioritize widget to pick branch champions and compare representatives.',
    showcase: {
      title: 'Interactive widgets can guide app workflows',
      description:
        'Prioritize asks for one branch champion, then uses focused A/B duels only when top-level representatives need comparison.',
      timing: { initialDelayMs: 900, stepDelayMs: 1900, storyDelayMs: 2600 },
    },
    kind: 'command',
    initialState: { chat: { messages: [] }, items: duelItems },
    sandbox: {
      todo: { items: duelItems, nextId: 305 },
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
          buildChampionPickStoryOutput({ alias: params.alias }),
          buildDuelQuestionStoryOutput({
            alias: params.alias,
            questionIndex: 1,
            question: 'Champion tournament 1 of ~1: which should you do first?',
            a: duelTodoA,
            b: duelSiblingRootTodo,
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
        state: { todo: { items: duelItems, nextId: 305 } },
      },
      {
        type: 'instruction',
        text: 'Open the Todo widget from the header to rank sibling tasks.',
        showcase: {
          title: 'Todo can ask focused interactive questions',
          description:
            'Prioritize asks for branch champions first, then compares representative paths only when needed.',
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
        text: 'Click Prioritize to start from the next unresolved branch.',
        showcase: {
          title: 'Prioritize starts bottom-up',
          description:
            'The widget first asks for a branch champion, so categories stay stable while real tasks compete.',
        },
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-prioritize' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-prioritize' },
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
        type: 'instruction',
        text: 'Pick the branch champion for the landing demo work.',
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-champion-pick-1' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-champion-pick-1' },
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
        type: 'instruction',
        text: 'Now choose between the branch representative and the other top-level task.',
        showcase: {
          title: 'Top-level priority uses representatives',
          description:
            'Once branches have champions, only those representative paths need A/B comparison.',
        },
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-duel-answer-1-A' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-duel-answer-1-A' },
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
        type: 'wait_for_action',
        match: {
          type: 'command_completed',
          command: params.alias,
          subcommand: 'duel',
        },
      },
      {
        type: 'instruction',
        text: 'The representative tournament returns to the list with the winning path highlighted.',
        showcase: {
          title: 'Priority winner returns to the list',
          description:
            'When prioritize is complete, the list highlights the branch champions and the overall winner.',
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
    items: duelRankedItems,
  });

  return story;
}

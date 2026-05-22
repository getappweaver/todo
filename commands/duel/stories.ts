import type { StoryDefinition } from '@src/system/story-definition';
import type { WebAction, WebNodeRoot } from '@src/web/ui-schema';

import {
  buildTodoListStoryCommandOutput,
  type TodoStoryState,
} from '../../story-support';
import type { Todo, TodoWithWinStats } from '../../types/todos';

import {
  renderDuelComplete,
  renderDuelQuestion,
  renderDuelScopeChoice,
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
        actionArgs: ['answer', String(params.a.id), String(params.b.id)],
      }),
    },
    b: {
      label: 'B',
      item: toDuelStoryItem(params.b),
      storyTargetId: answerBTargetId,
      action: duelStoryAction({
        alias: params.alias,
        actionArgs: ['answer', String(params.b.id), String(params.a.id)],
      }),
    },
    actions: [
      duelStoryButton({
        label: 'Skip',
        className: null,
        storyTargetId: null,
        action: duelStoryAction({ alias: params.alias, actionArgs: ['skip'] }),
      }),
      duelStoryButton({
        label: 'Reset',
        className: null,
        storyTargetId: null,
        action: duelStoryAction({ alias: params.alias, actionArgs: ['reset'] }),
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

function buildDuelScopeChoiceStoryOutput(params: {
  alias: string;
}): WebNodeRoot {
  return renderDuelScopeChoice({
    commandAlias: params.alias,
    selectedId: duelParentTodo.id,
    returnRootId: null,
    title: `Choose duel scope for ${duelParentTodo.todo}`,
    childCount: 3,
    siblingCount: 2,
    childrenStoryTargetId: 'todo-duel-scope-children',
    siblingsStoryTargetId: 'todo-duel-scope-siblings',
  });
}

function buildDuelCompleteStoryOutput(params: { alias: string }): WebNodeRoot {
  return renderDuelComplete({
    commandAlias: params.alias,
    parentId: duelParentTodo.id,
    title: duelParentTodo.todo,
    ranked: duelRankedItems
      .filter((item) => item.parent_id === duelParentTodo.id)
      .map(toDuelStoryItem),
    actions: [
      duelStoryButton({
        label: 'Done',
        className: null,
        storyTargetId: 'todo-duel-done',
        action: duelStoryAction({ alias: params.alias, actionArgs: ['quit'] }),
      }),
      duelStoryButton({
        label: 'Reset and re-duel',
        className: 'todo-duel-danger-button',
        storyTargetId: null,
        action: duelStoryAction({ alias: params.alias, actionArgs: ['reset'] }),
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
    title: 'Prioritize todos with duel',
    description:
      'Use the Todo duel widget to rank sibling tasks through interactive pairwise choices.',
    showcase: {
      title: 'Interactive widgets can guide app workflows',
      description:
        'Duel asks simple A/B questions, records comparisons, and turns a flat task list into a ranked priority order.',
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
          buildDuelScopeChoiceStoryOutput({ alias: params.alias }),
          buildDuelQuestionStoryOutput({
            alias: params.alias,
            questionIndex: 1,
            question: 'Question 1 of 3: which is more important?',
            a: duelTodoA,
            b: duelTodoB,
          }),
          buildDuelQuestionStoryOutput({
            alias: params.alias,
            questionIndex: 2,
            question: 'Question 2 of 3: which is more important?',
            a: duelTodoA,
            b: duelTodoC,
          }),
          buildDuelQuestionStoryOutput({
            alias: params.alias,
            questionIndex: 3,
            question: 'Question 3 of 3: which is more important?',
            a: duelTodoB,
            b: duelTodoC,
          }),
          buildDuelCompleteStoryOutput({ alias: params.alias }),
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
        text: 'Expand the root item first so the child tasks are visible before choosing a duel scope.',
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: `todo-tree-toggle-${duelParentTodo.id}`,
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: `todo-tree-toggle-${duelParentTodo.id}`,
        },
      },
      {
        type: 'instruction',
        text: 'Hover the parent row to reveal its row actions.',
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: `todo-row-${duelParentTodo.id}` },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_hovered',
          targetId: `todo-row-${duelParentTodo.id}`,
        },
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
        type: 'wait_for_action',
        match: {
          type: 'command_completed',
          command: params.alias,
          subcommand: 'duel',
        },
      },
      {
        type: 'instruction',
        text: 'Choose to duel the child tasks under the selected parent.',
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-duel-scope-children' },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: 'todo-duel-scope-children',
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
        text: 'Choose A for the first comparison.',
        showcase: {
          title: 'Each answer records one comparison',
          description:
            'Simple A/B choices are enough for the plugin to build a ranking graph.',
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
        type: 'instruction',
        text: 'Choose A again for the second comparison.',
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-duel-answer-2-A' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-duel-answer-2-A' },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'command_completed',
          command: params.alias,
          subcommand: 'duel',
        },
      },
      { type: 'instruction', text: 'Choose A for the final comparison.' },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-duel-answer-3-A' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-duel-answer-3-A' },
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
        text: 'Click Done to return to the ranked todo list.',
        showcase: {
          title: 'Duel returns a scored list',
          description:
            'When the ranking is complete, Done closes the duel view. The children are reordered and no longer marked unscored.',
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

import type { StoryDefinition } from '@src/system/story-definition';
import type { WebAction, WebNodeRoot } from '@src/web/ui-schema';

import {
  buildTodoListStoryCommandOutput,
  type TodoStoryState,
} from '../../story-support';
import type { Todo, TodoWithWinStats } from '../../types/todos';

import { renderListWeb } from '../list/renderers/web';
import { createListRepresentation } from '../list/representation/builder';

import {
  renderChampionQuestion,
  renderDuelQuestion,
  type DuelButton,
  type DuelTodoItem,
} from './component';

type DuelStoryRankedItem = TodoWithWinStats & {
  isChampion: boolean;
  isPriorityWinner: boolean;
};

type DuelStoryListItem = Todo | TodoWithWinStats | DuelStoryRankedItem;

type BuildDuelListStoryCommandOutputProps = {
  prefix: string;
  alias: string;
  items: DuelStoryListItem[];
};

type BuildChampionPickStoryOutputProps = {
  alias: string;
  parentId: number;
  parentPath: string[];
  currentParentId: number;
  rootChampionSelections: Map<number, number>;
  choices: Array<Todo & { storyTargetId: string | null }>;
};

type BuildDuelQuestionStoryOutputProps = {
  alias: string;
  questionIndex: number;
  question: string;
  a: Todo;
  b: Todo;
  rootChampionSelections: Map<number, number>;
};

const duelMarketingTodo = {
  id: 302,
  parent_id: null,
  todo: 'MARKETING',
  status: 'pending',
  sort_order: 1,
  description: 'Marketing branch champion candidate.',
  tags: ['demo', 'marketing'],
  source: 'demo',
  created_at: 1714005100,
  updated_at: 1714005100,
  completed_at: null,
} satisfies Todo;

const duelMarketingBlogTodo = {
  id: 303,
  parent_id: duelMarketingTodo.id,
  todo: 'blog',
  status: 'pending',
  sort_order: 1,
  description: 'Blog branch item for marketing.',
  tags: ['demo', 'blog'],
  source: 'demo',
  created_at: 1714005200,
  updated_at: 1714005200,
  completed_at: null,
} satisfies Todo;

const duelMarketingLandingTodo = {
  id: 304,
  parent_id: duelMarketingTodo.id,
  todo: 'landing page',
  status: 'pending',
  sort_order: 1,
  description: 'Landing page branch item for marketing.',
  tags: ['demo', 'landing-page'],
  source: 'demo',
  created_at: 1714005300,
  updated_at: 1714005300,
  completed_at: null,
} satisfies Todo;

const duelWalletTodo = {
  id: 305,
  parent_id: null,
  todo: 'WALLET',
  status: 'pending',
  sort_order: 2,
  description: 'Wallet branch candidate.',
  tags: ['demo', 'wallet'],
  source: 'demo',
  created_at: 1714005400,
  updated_at: 1714005400,
  completed_at: null,
} satisfies Todo;

const duelWalletImportTodo = {
  id: 306,
  parent_id: duelWalletTodo.id,
  todo: 'import wallet',
  status: 'pending',
  sort_order: 1,
  description: 'Import wallet branch item.',
  tags: ['demo', 'wallet'],
  source: 'demo',
  created_at: 1714005500,
  updated_at: 1714005500,
  completed_at: null,
} satisfies Todo;

const duelMediaTodo = {
  id: 307,
  parent_id: null,
  todo: 'MEDIA',
  status: 'pending',
  sort_order: 3,
  description: 'Another branch to make the tree feel real.',
  tags: ['demo', 'media'],
  source: 'demo',
  created_at: 1714005600,
  updated_at: 1714005600,
  completed_at: null,
} satisfies Todo;

const duelMediaRecordTodo = {
  id: 308,
  parent_id: duelMediaTodo.id,
  todo: 'record story playback states',
  status: 'pending',
  sort_order: 1,
  description: 'Media branch item for story playback.',
  tags: ['demo', 'stories'],
  source: 'demo',
  created_at: 1714005700,
  updated_at: 1714005700,
  completed_at: null,
} satisfies Todo;

const duelMarketingLocalFirstTodo = {
  id: 309,
  parent_id: duelMarketingTodo.id,
  todo: 'What does local-first mean?',
  status: 'pending',
  sort_order: 1,
  description: 'Marketing branch item about local-first messaging.',
  tags: ['demo', 'local-first'],
  source: 'demo',
  created_at: 1714005800,
  updated_at: 1714005800,
  completed_at: null,
} satisfies Todo;

const duelWalletConnectTodo = {
  id: 310,
  parent_id: duelWalletTodo.id,
  todo: 'connect wallet',
  status: 'pending',
  sort_order: 1,
  description: 'Wallet branch item for connection flows.',
  tags: ['demo', 'wallet'],
  source: 'demo',
  created_at: 1714005900,
  updated_at: 1714005900,
  completed_at: null,
} satisfies Todo;

const duelWalletMultisigTodo = {
  id: 311,
  parent_id: duelWalletTodo.id,
  todo: 'multisig setup',
  status: 'pending',
  sort_order: 1,
  description: 'Wallet branch item for multisig onboarding.',
  tags: ['demo', 'wallet'],
  source: 'demo',
  created_at: 1714006000,
  updated_at: 1714006000,
  completed_at: null,
} satisfies Todo;

const duelMediaThumbnailsTodo = {
  id: 312,
  parent_id: duelMediaTodo.id,
  todo: 'add video thumbnails',
  status: 'pending',
  sort_order: 1,
  description: 'Media branch item for visual previews.',
  tags: ['demo', 'media'],
  source: 'demo',
  created_at: 1714006100,
  updated_at: 1714006100,
  completed_at: null,
} satisfies Todo;

const duelMediaPreviewTodo = {
  id: 313,
  parent_id: duelMediaTodo.id,
  todo: 'improve preview',
  status: 'pending',
  sort_order: 1,
  description: 'Media branch item for playback previews.',
  tags: ['demo', 'media'],
  source: 'demo',
  created_at: 1714006200,
  updated_at: 1714006200,
  completed_at: null,
} satisfies Todo;

const duelItems = [
  duelMarketingTodo,
  duelMarketingBlogTodo,
  duelMarketingLandingTodo,
  duelMarketingLocalFirstTodo,
  duelWalletTodo,
  duelWalletImportTodo,
  duelWalletConnectTodo,
  duelWalletMultisigTodo,
  duelMediaTodo,
  duelMediaRecordTodo,
  duelMediaThumbnailsTodo,
  duelMediaPreviewTodo,
] satisfies Todo[];

const duelRankedItems = [
  { ...duelMarketingTodo, wins: 4, losses: 0, win_rate: 1 },
  { ...duelMarketingBlogTodo, wins: 3, losses: 1, win_rate: 0.75 },
  { ...duelMarketingLandingTodo, wins: 2, losses: 2, win_rate: 0.5 },
  { ...duelMarketingLocalFirstTodo, wins: 1, losses: 3, win_rate: 0.25 },
  { ...duelWalletTodo, wins: 1, losses: 1, win_rate: 0.5 },
  { ...duelWalletImportTodo, wins: 2, losses: 1, win_rate: 0.67 },
  { ...duelWalletConnectTodo, wins: 1, losses: 2, win_rate: 0.33 },
  { ...duelWalletMultisigTodo, wins: 0, losses: 3, win_rate: 0 },
  { ...duelMediaTodo, wins: 0, losses: 2, win_rate: 0 },
  { ...duelMediaRecordTodo, wins: 2, losses: 0, win_rate: 1 },
  { ...duelMediaThumbnailsTodo, wins: 1, losses: 1, win_rate: 0.5 },
  { ...duelMediaPreviewTodo, wins: 0, losses: 2, win_rate: 0 },
] satisfies TodoWithWinStats[];

const duelFinalRankedItems = [
  {
    ...duelMarketingTodo,
    wins: 4,
    losses: 0,
    win_rate: 1,
    isChampion: true,
    isPriorityWinner: false,
  },
  {
    ...duelMarketingBlogTodo,
    wins: 3,
    losses: 1,
    win_rate: 0.75,
    isChampion: true,
    isPriorityWinner: true,
  },
  {
    ...duelMarketingLandingTodo,
    wins: 2,
    losses: 2,
    win_rate: 0.5,
    isChampion: false,
    isPriorityWinner: false,
  },
  {
    ...duelMarketingLocalFirstTodo,
    wins: 1,
    losses: 3,
    win_rate: 0.25,
    isChampion: false,
    isPriorityWinner: false,
  },
  {
    ...duelWalletTodo,
    wins: 1,
    losses: 1,
    win_rate: 0.5,
    isChampion: true,
    isPriorityWinner: false,
  },
  {
    ...duelWalletImportTodo,
    wins: 2,
    losses: 1,
    win_rate: 0.67,
    isChampion: true,
    isPriorityWinner: false,
  },
  {
    ...duelWalletConnectTodo,
    wins: 1,
    losses: 2,
    win_rate: 0.33,
    isChampion: false,
    isPriorityWinner: false,
  },
  {
    ...duelWalletMultisigTodo,
    wins: 0,
    losses: 3,
    win_rate: 0,
    isChampion: false,
    isPriorityWinner: false,
  },
  {
    ...duelMediaTodo,
    wins: 0,
    losses: 2,
    win_rate: 0,
    isChampion: true,
    isPriorityWinner: false,
  },
  {
    ...duelMediaRecordTodo,
    wins: 2,
    losses: 0,
    win_rate: 1,
    isChampion: true,
    isPriorityWinner: false,
  },
  {
    ...duelMediaThumbnailsTodo,
    wins: 1,
    losses: 1,
    win_rate: 0.5,
    isChampion: false,
    isPriorityWinner: false,
  },
  {
    ...duelMediaPreviewTodo,
    wins: 0,
    losses: 2,
    win_rate: 0,
    isChampion: false,
    isPriorityWinner: false,
  },
] satisfies DuelStoryRankedItem[];

function buildDuelTreeItem(
  item: Todo,
  rootChampionSelections: Map<number, number>,
): DuelTodoItem {
  const selectedChampionId =
    item.parent_id === null
      ? (rootChampionSelections.get(item.id) ?? null)
      : null;

  return {
    id: item.id,
    todo: item.todo,
    status: item.status,
    hasChampion: item.parent_id === null ? selectedChampionId !== null : false,
    selectedChampion:
      item.parent_id !== null &&
      (rootChampionSelections.get(item.parent_id) ?? null) === item.id,
    children: duelItems
      .filter((child) => child.parent_id === item.id)
      .map((child) => buildDuelTreeItem(child, rootChampionSelections)),
  };
}

function buildDuelListStoryCommandOutput({
  prefix,
  alias,
  items,
}: BuildDuelListStoryCommandOutputProps): NonNullable<
  StoryDefinition<TodoStoryState>['commandOutput']
> {
  const itemsById = new Map(items.map((item) => [item.id, item]));

  const representation = createListRepresentation({
    command: alias,
    subcommand: 'list',
    scope: null,
    view: 'tree',
    showDescriptions: false,
    listInvocation: {
      arguments: {},
      options: {},
    },
    priorityPrompt: null,
    items: items.map((item) => {
      let depth = 0;
      let parentId = item.parent_id;

      while (parentId !== null) {
        depth += 1;
        parentId = itemsById.get(parentId)?.parent_id ?? null;
      }

      const stats =
        'win_rate' in item
          ? {
              wins: item.wins,
              losses: item.losses,
              winRate: item.win_rate,
            }
          : { wins: 0, losses: 0, winRate: null };

      return {
        id: item.id,
        parentId: item.parent_id,
        text: item.todo,
        status: item.status,
        description: item.description,
        depth,
        ...stats,
        isChampion: 'isChampion' in item ? item.isChampion : false,
        isPriorityWinner:
          'isPriorityWinner' in item ? item.isPriorityWinner : false,
      };
    }),
  });

  return {
    text: null,
    web: renderListWeb(representation, { prefix }),
    clientView: null,
  };
}

function buildRootChampionSelections({
  entries,
}: {
  entries: Array<[number, number]>;
}): Map<number, number> {
  return new Map(entries);
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
      duelArgs: ['web', ...params.actionArgs, 'returnRoot', 'root'],
    },
    options: {},
    recordInTimeline: false,
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

function buildDuelQuestionStoryOutput({
  alias,
  questionIndex,
  question,
  a,
  b,
  rootChampionSelections,
}: BuildDuelQuestionStoryOutputProps): WebNodeRoot {
  const answerATargetId = `todo-duel-answer-${questionIndex}-A`;
  const answerBTargetId = `todo-duel-answer-${questionIndex}-B`;
  const excludedRootIds = new Set([a.parent_id ?? a.id, b.parent_id ?? b.id]);

  return renderDuelQuestion({
    commandAlias: alias,
    parentId: null,
    title: 'Prioritize todos',
    notice: null,
    question,
    a: {
      label: 'A',
      item: buildDuelTreeItem(a, rootChampionSelections),
      storyTargetId: answerATargetId,
      action: duelStoryAction({
        alias,
        actionArgs: [
          'prioritizeAnswer',
          String(a.id),
          String(b.id),
          'story-root-scope-hash',
          'prioritizeRoot',
          'root',
        ],
      }),
    },
    b: {
      label: 'B',
      item: buildDuelTreeItem(b, rootChampionSelections),
      storyTargetId: answerBTargetId,
      action: duelStoryAction({
        alias,
        actionArgs: [
          'prioritizeAnswer',
          String(b.id),
          String(a.id),
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
          alias,
          actionArgs: [
            'prioritizeDuelSkip',
            String(a.id),
            String(b.id),
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
        action: duelStoryAction({ alias, actionArgs: ['quit'] }),
      }),
    ],
    remaining: duelItems
      .filter(
        (item) => item.parent_id === null && !excludedRootIds.has(item.id),
      )
      .map((item) => buildDuelTreeItem(item, rootChampionSelections)),
  });
}

function buildChampionPickStoryOutput({
  alias,
  parentId,
  parentPath,
  currentParentId,
  rootChampionSelections,
  choices,
}: BuildChampionPickStoryOutputProps): WebNodeRoot {
  return renderChampionQuestion({
    commandAlias: alias,
    parentId,
    title: 'Prioritize todos',
    notice: null,
    context: {
      parentPath,
      currentParentId,
      rootItems: [duelMarketingTodo, duelWalletTodo, duelMediaTodo].map(
        (item) => buildDuelTreeItem(item, rootChampionSelections),
      ),
      defaultExpandedIds: [
        duelMarketingTodo.id,
        duelWalletTodo.id,
        duelMediaTodo.id,
      ],
    },
    choices: choices.map((item) => ({
      item: buildDuelTreeItem(item, rootChampionSelections),
      label: 'Pick',
      storyTargetId: item.storyTargetId,
      action: duelStoryAction({
        alias,
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
        action: duelStoryAction({ alias, actionArgs: ['quit'] }),
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
        'Prioritize asks for branch champions, then uses two focused A/B duels to find the winner.',
      timing: { initialDelayMs: 900, stepDelayMs: 1900, storyDelayMs: 2600 },
    },
    kind: 'command',
    initialState: { chat: { messages: [] }, items: duelItems },
    sandbox: {
      todo: { items: duelItems, nextId: 314 },
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
          buildChampionPickStoryOutput({
            alias: params.alias,
            parentId: duelMarketingTodo.id,
            parentPath: [duelMarketingTodo.todo],
            currentParentId: duelMarketingTodo.id,
            rootChampionSelections: new Map(),
            choices: [
              {
                ...duelMarketingBlogTodo,
                storyTargetId: 'todo-champion-pick-1',
              },
              {
                ...duelMarketingLandingTodo,
                storyTargetId: null,
              },
              {
                ...duelMarketingLocalFirstTodo,
                storyTargetId: null,
              },
            ],
          }),
          buildChampionPickStoryOutput({
            alias: params.alias,
            parentId: duelWalletTodo.id,
            parentPath: [duelWalletTodo.todo],
            currentParentId: duelWalletTodo.id,
            rootChampionSelections: buildRootChampionSelections({
              entries: [[duelMarketingTodo.id, duelMarketingBlogTodo.id]],
            }),
            choices: [
              {
                ...duelWalletImportTodo,
                storyTargetId: 'todo-champion-pick-2',
              },
              {
                ...duelWalletConnectTodo,
                storyTargetId: null,
              },
              {
                ...duelWalletMultisigTodo,
                storyTargetId: null,
              },
            ],
          }),
          buildChampionPickStoryOutput({
            alias: params.alias,
            parentId: duelMediaTodo.id,
            parentPath: [duelMediaTodo.todo],
            currentParentId: duelMediaTodo.id,
            rootChampionSelections: buildRootChampionSelections({
              entries: [
                [duelMarketingTodo.id, duelMarketingBlogTodo.id],
                [duelWalletTodo.id, duelWalletImportTodo.id],
              ],
            }),
            choices: [
              {
                ...duelMediaRecordTodo,
                storyTargetId: 'todo-champion-pick-3',
              },
              {
                ...duelMediaThumbnailsTodo,
                storyTargetId: null,
              },
              {
                ...duelMediaPreviewTodo,
                storyTargetId: null,
              },
            ],
          }),
          buildDuelQuestionStoryOutput({
            alias: params.alias,
            questionIndex: 1,
            question: 'Champion tournament 1 of ~2: which should you do first?',
            a: duelMarketingBlogTodo,
            b: duelWalletImportTodo,
            rootChampionSelections: buildRootChampionSelections({
              entries: [
                [duelMarketingTodo.id, duelMarketingBlogTodo.id],
                [duelWalletTodo.id, duelWalletImportTodo.id],
              ],
            }),
          }),
          buildDuelQuestionStoryOutput({
            alias: params.alias,
            questionIndex: 2,
            question: 'Champion tournament 2 of ~2: which should you do first?',
            a: duelMarketingBlogTodo,
            b: duelMediaRecordTodo,
            rootChampionSelections: buildRootChampionSelections({
              entries: [
                [duelMarketingTodo.id, duelMarketingBlogTodo.id],
                [duelWalletTodo.id, duelWalletImportTodo.id],
                [duelMediaTodo.id, duelMediaRecordTodo.id],
              ],
            }),
          }),
          buildDuelListStoryCommandOutput({
            prefix: params.prefix,
            alias: params.alias,
            items: duelFinalRankedItems,
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
        state: { todo: { items: duelItems, nextId: 314 } },
      },
      {
        type: 'instruction',
        text: 'Open the Todo widget from the header to rank branch work.',
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
        text: 'Pick the champion inside the MARKETING branch.',
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
        text: 'Pick the champion inside the WALLET branch.',
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-champion-pick-2' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-champion-pick-2' },
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
        text: 'Pick the champion inside the MEDIA branch.',
      },
      {
        type: 'focus_target',
        target: { type: 'web_node', targetId: 'todo-champion-pick-3' },
      },
      {
        type: 'wait_for_action',
        match: { type: 'target_clicked', targetId: 'todo-champion-pick-3' },
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
        text: 'Now duel the first two branch champions.',
        showcase: {
          title: 'Priority duels use representatives',
          description:
            'Once branches have champions, the first duel narrows the field to two finalists.',
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
        text: 'Now duel the winner against the third branch champion.',
        showcase: {
          title: 'Priority duels finish the bracket',
          description:
            'Two duels are enough to pick one winner from three branch champions.',
        },
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
      {
        type: 'instruction',
        text: 'The final list returns with the branch champions and overall winner highlighted.',
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

  story.commandOutput = buildDuelListStoryCommandOutput({
    prefix: params.prefix,
    alias: params.alias,
    items: duelFinalRankedItems,
  });

  return story;
}

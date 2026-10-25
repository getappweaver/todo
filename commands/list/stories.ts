import type { StoryDefinition } from '@src/system/story-definition';

import {
  buildTodoListStoryCommandOutput,
  type TodoStoryState,
} from '../../story-support';
import type { Todo } from '../../types/todos';

type BuildFilterChampionsStoryProps = {
  prefix: string;
  alias: string;
};

const marketingBranch = {
  id: 401,
  parent_id: null,
  todo: 'MARKETING',
  status: 'pending',
  sort_order: 1,
  description: null,
  tags: ['demo', 'marketing'],
  source: 'demo',
  created_at: 1714005100,
  updated_at: 1714005100,
  completed_at: null,
} satisfies Todo;

const releaseNotesTodo = {
  id: 402,
  parent_id: marketingBranch.id,
  todo: 'Publish release notes',
  status: 'pending',
  sort_order: 1,
  description: 'Announce v14 features with screenshots.',
  tags: ['demo', 'marketing'],
  source: 'demo',
  created_at: 1714005200,
  updated_at: 1714005200,
  completed_at: null,
} satisfies Todo;

const landingPageTodo = {
  id: 403,
  parent_id: marketingBranch.id,
  todo: 'Update landing page animations',
  status: 'pending',
  sort_order: 2,
  description: null,
  tags: ['demo', 'marketing'],
  source: 'demo',
  created_at: 1714005300,
  updated_at: 1714005300,
  completed_at: null,
} satisfies Todo;

const onboardingBranch = {
  id: 404,
  parent_id: null,
  todo: 'ONBOARDING',
  status: 'pending',
  sort_order: 2,
  description: null,
  tags: ['demo', 'onboarding'],
  source: 'demo',
  created_at: 1714005400,
  updated_at: 1714005400,
  completed_at: null,
} satisfies Todo;

const walkthroughTourTodo = {
  id: 405,
  parent_id: onboardingBranch.id,
  todo: 'Interactive walkthrough tour',
  status: 'pending',
  sort_order: 1,
  description: null,
  tags: ['demo', 'onboarding'],
  source: 'demo',
  created_at: 1714005500,
  updated_at: 1714005500,
  completed_at: null,
} satisfies Todo;

const cheatsheetTodo = {
  id: 406,
  parent_id: onboardingBranch.id,
  todo: 'Keyboard shortcut cheatsheet',
  status: 'pending',
  sort_order: 2,
  description: null,
  tags: ['demo', 'onboarding'],
  source: 'demo',
  created_at: 1714005600,
  updated_at: 1714005600,
  completed_at: null,
} satisfies Todo;

const mobileBranch = {
  id: 407,
  parent_id: null,
  todo: 'MOBILE EXPERIENCE',
  status: 'pending',
  sort_order: 3,
  description: null,
  tags: ['demo', 'mobile'],
  source: 'demo',
  created_at: 1714005700,
  updated_at: 1714005700,
  completed_at: null,
} satisfies Todo;

const navigationTodo = {
  id: 408,
  parent_id: mobileBranch.id,
  todo: 'Responsive dock navigation',
  status: 'pending',
  sort_order: 1,
  description: null,
  tags: ['demo', 'mobile'],
  source: 'demo',
  created_at: 1714005800,
  updated_at: 1714005800,
  completed_at: null,
} satisfies Todo;

const initialListItems = [
  { ...marketingBranch, isChampion: true, isPriorityWinner: false },
  { ...releaseNotesTodo, isChampion: true, isPriorityWinner: true },
  { ...landingPageTodo, isChampion: false, isPriorityWinner: false },
  { ...onboardingBranch, isChampion: true, isPriorityWinner: false },
  { ...walkthroughTourTodo, isChampion: true, isPriorityWinner: false },
  { ...cheatsheetTodo, isChampion: false, isPriorityWinner: false },
  { ...mobileBranch, isChampion: true, isPriorityWinner: false },
  { ...navigationTodo, isChampion: true, isPriorityWinner: false },
];

const championFilteredItems = [
  { ...marketingBranch, isChampion: true, isPriorityWinner: false },
  { ...releaseNotesTodo, isChampion: true, isPriorityWinner: true },
  { ...onboardingBranch, isChampion: true, isPriorityWinner: false },
  { ...walkthroughTourTodo, isChampion: true, isPriorityWinner: false },
  { ...mobileBranch, isChampion: true, isPriorityWinner: false },
  { ...navigationTodo, isChampion: true, isPriorityWinner: false },
];

export function buildFilterChampionsStory({
  prefix,
  alias,
}: BuildFilterChampionsStoryProps): StoryDefinition<TodoStoryState> {
  const story: StoryDefinition<TodoStoryState> = {
    id: 'todo-filter-champions',
    title: 'Show only champions',
    description:
      'Collapse noisy branches.\nSurface **branch champions** and your *#1 priority*',
    showcase: {
      title: 'Cut the noise.\nKeep the winners.',
      description:
        'Collapse noisy branches.\nSurface **branch champions** and your *#1 priority*',
      timing: { initialDelayMs: 600, stepDelayMs: 1600, storyDelayMs: 2200 },
    },
    kind: 'command',
    initialState: {
      chat: { messages: [] },
      items: [
        marketingBranch,
        releaseNotesTodo,
        landingPageTodo,
        onboardingBranch,
        walkthroughTourTodo,
        cheatsheetTodo,
        mobileBranch,
        navigationTodo,
      ],
    },
    sandbox: {
      todo: {
        items: [
          marketingBranch,
          releaseNotesTodo,
          landingPageTodo,
          onboardingBranch,
          walkthroughTourTodo,
          cheatsheetTodo,
          mobileBranch,
          navigationTodo,
        ],
        nextId: 409,
      },
      __outputs: {
        [`${alias}:list`]: [
          buildTodoListStoryCommandOutput({
            prefix,
            alias,
            items: initialListItems,
            listOptions: {},
          }).web,
          buildTodoListStoryCommandOutput({
            prefix,
            alias,
            items: championFilteredItems,
            listOptions: { champion: true },
          }).web,
        ],
      },
      __transitions: [
        {
          on: { command: alias, subcommand: 'list' },
          advanceOutput: { command: alias, subcommand: 'list' },
        },
      ],
    },
    steps: [
      {
        type: 'seed_sandbox',
        state: {
          todo: {
            items: [
              marketingBranch,
              releaseNotesTodo,
              landingPageTodo,
              onboardingBranch,
              walkthroughTourTodo,
              cheatsheetTodo,
              mobileBranch,
              navigationTodo,
            ],
            nextId: 409,
          },
        },
      },
      {
        type: 'instruction',
        text: 'Open the Todo widget to review your hierarchical tasks.',
        showcase: {
          title: 'Organize complex projects with nested tasks',
          description:
            'Group tasks into clean branches while maintaining hierarchical context across your entire project.',
        },
      },
      {
        type: 'focus_target',
        target: {
          type: 'header_widget',
          command: alias,
          subcommand: 'list',
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'widget_opened',
          command: alias,
          subcommand: 'list',
        },
      },
      {
        type: 'instruction',
        text: 'Click the list options to open view display controls.',
        showcase: {
          title: 'Instant view controls',
          description:
            'Quickly toggle view filters without changing or losing your underlying task data.',
        },
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: 'todo-list-filter-toggle',
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: 'todo-list-filter-toggle',
        },
      },
      {
        type: 'instruction',
        text: 'Enable Show only champions to filter out background noise.',
        showcase: {
          title: 'Show only champions',
          description:
            'Collapse noisy branches.\nSurface **branch champions** and your *#1 priority*',
        },
      },
      {
        type: 'focus_target',
        target: {
          type: 'web_node',
          targetId: 'todo-filter-champion',
        },
      },
      {
        type: 'wait_for_action',
        match: {
          type: 'target_clicked',
          targetId: 'todo-filter-champion',
        },
      },
      {
        type: 'complete',
      },
    ],
  };

  return story;
}

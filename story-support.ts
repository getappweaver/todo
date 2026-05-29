import type {
  StoryChatState,
  StoryDefinition,
} from '@src/system/story-definition';

import { renderListWeb } from './commands/list/renderers/web';
import { createListRepresentation } from './commands/list/representation/builder';
import type { Todo, TodoWithWinStats } from './types/todos';

export type TodoStoryState = {
  chat: StoryChatState;
  items: Todo[];
};

export const emptyTodoItems = [] satisfies Todo[];

type TodoStoryListItem = Todo | TodoWithWinStats;

export function buildTodoListStoryCommandOutput(params: {
  prefix: string;
  alias: string;
  items: TodoStoryListItem[];
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
    priorityPrompt: null,
    items: params.items.map((item) => {
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
      };
    }),
  });

  return {
    text: null,
    web: renderListWeb(representation, { prefix: params.prefix }),
    clientView: null,
  };
}

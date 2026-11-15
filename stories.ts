import type { StoryDefinition } from '@src/system/story-definition';

import { buildAddStory } from './commands/add/stories';
import { buildAiPromptStory } from './commands/ai/stories';
import { buildFilterChampionsStory } from './commands/list/stories';

export function todoStories(
  prefix: string,
  alias: string,
): StoryDefinition<unknown>[] {
  return [
    buildAddStory({ prefix, alias }),
    buildAiPromptStory({ prefix, alias }),
    buildFilterChampionsStory({ prefix, alias }),
  ];
}

import { createTextPrompt } from '@src/core/plugin';

import type { Todo } from '../../../types/todos';

import { formatWinRate } from '../db';
import type { RankedTodo } from '../representation';

const PATH_STATUS_ICON: Record<string, string> = {
  pending: '[ ]',
  in_progress: '[~]',
  done: '[x]',
  cancelled: '[-]',
};

const PATH_BULLET = '- ';

export function createDuelTextPrompt(text: string) {
  return createTextPrompt(text);
}

export function formatLeafWithAncestorPath(
  path: Todo[],
  leaf: RankedTodo,
): string {
  if (path.length === 0) {
    return '';
  }

  return path
    .map((todo, index) => {
      const prefix = '  '.repeat(2 * (index + 1));
      const icon = PATH_STATUS_ICON[todo.status] ?? '[ ]';
      const isLeafLine = todo.id === leaf.id;
      const winPart = isLeafLine ? ` (${formatWinRate(leaf)})` : '';

      return `${prefix}${PATH_BULLET}${icon} ${todo.todo}${winPart}  (id: ${todo.id})`;
    })
    .join('\n');
}

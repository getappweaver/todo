import { formatTodoDetail } from '../../output/todo-detail/format';
import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleMoveCommand } from './handler';

export function adaptMoveCommand(params: TodoCommandAdapterParams): string {
  const result = handleMoveCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
    options: params.parsed.options,
  });

  if (result.type === 'success' && result.item) {
    return `${result.message}\n${formatTodoDetail(result.item)}`;
  }

  return result.message;
}

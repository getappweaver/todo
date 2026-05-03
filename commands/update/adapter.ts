import { formatTodoDetail } from '../../output/todo-detail/format';
import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleUpdateCommand } from './handler';

export function adaptUpdateCommand(params: TodoCommandAdapterParams): string {
  const result = handleUpdateCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
  });

  if (result.type === 'success') {
    return `${result.message}\n${formatTodoDetail(result.item)}`;
  }

  return result.message;
}

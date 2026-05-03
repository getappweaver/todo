import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleDoneCommand } from './handler';

export function adaptDoneCommand(params: TodoCommandAdapterParams): string {
  const result = handleDoneCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
  });

  return result.message;
}

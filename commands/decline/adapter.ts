import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleDeclineCommand } from './handler';

export function adaptDeclineCommand(params: TodoCommandAdapterParams): string {
  const result = handleDeclineCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
  });

  return result.message;
}

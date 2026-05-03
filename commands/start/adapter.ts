import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleStartCommand } from './handler';

export function adaptStartCommand(params: TodoCommandAdapterParams): string {
  const result = handleStartCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
  });

  return result.message;
}

import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleAcceptCommand } from './handler';

export function adaptAcceptCommand(params: TodoCommandAdapterParams): string {
  const result = handleAcceptCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
  });

  return result.message;
}

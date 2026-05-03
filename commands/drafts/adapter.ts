import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleDraftsCommand } from './handler';

export function adaptDraftsCommand(params: TodoCommandAdapterParams): string {
  const result = handleDraftsCommand({
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
    prefix: params.prefix,
  });

  return result.type === 'success' ? result.text : result.message;
}

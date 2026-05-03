import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleDeleteCommand } from './handler';

export function adaptDeleteCommand(params: TodoCommandAdapterParams): string {
  const result = handleDeleteCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
  });

  return result.message;
}

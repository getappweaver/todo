import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleReviseCommand } from './handler';

export async function adaptReviseCommand(
  params: TodoCommandAdapterParams,
): Promise<string> {
  const result = await handleReviseCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
    runAgent: params.runAgent,
  });

  return result.message;
}

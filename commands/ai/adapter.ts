import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleAiCommand } from './handler';
import { runAiDraftReviewSession } from './session';

export async function adaptAiCommand(
  params: TodoCommandAdapterParams,
): Promise<string> {
  const result = await handleAiCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
    options: params.parsed.options,
    agent: params.agent,
  });

  if (result.type === 'error') {
    return result.message;
  }

  if (result.type === 'list') {
    return result.text;
  }

  return await runAiDraftReviewSession({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    sessionId: result.sessionId,
    source: params.source,
    agent: params.agent,
    promptFn: params.promptFn,
  });
}

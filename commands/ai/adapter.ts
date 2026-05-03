import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleAiCommand } from './handler';
import { runAiDraftReviewSession } from './session';

export async function adaptAiCommand(
  params: TodoCommandAdapterParams,
): Promise<string> {
  if (!params.runAgent) {
    return `${params.prefix}${params.alias} ai requires an agent backend. Set backend (e.g. ${params.prefix}backend opencode-sdk) and try again.`;
  }

  const result = await handleAiCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
    runAgent: params.runAgent,
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
    runAgent: params.runAgent,
    promptFn: params.promptFn,
  });
}

import type { ParsedCliInvocation } from '@src/system/parser-cli';

import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleNextCommand } from '../duel/handler';

function toArgs(parsed: ParsedCliInvocation): string[] {
  const parentId = parsed.arguments.parentId;

  return typeof parentId === 'number' ? [String(parentId)] : [];
}

export async function adaptNextCommand(
  params: TodoCommandAdapterParams,
): Promise<string> {
  return await handleNextCommand({
    args: toArgs(params.parsed),
    db: params.db,
    source: params.source,
    sendReply: params.sendReply,
    promptFn: params.promptFn,
  });
}

import type { ParsedCliInvocation } from '@src/system/parser-cli';

import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleDuelCommand } from './handler';

function toArgs(parsed: ParsedCliInvocation): string[] {
  const args: string[] = [];

  if (typeof parsed.arguments.parentId === 'number') {
    args.push(String(parsed.arguments.parentId));
  }

  if (parsed.options.reset === true) {
    args.push('--reset');
  }

  return args;
}

export async function adaptDuelCommand(
  params: TodoCommandAdapterParams,
): Promise<string> {
  return await handleDuelCommand({
    args: toArgs(params.parsed),
    db: params.db,
    source: params.source,
    sendReply: params.sendReply,
    promptFn: params.promptFn,
  });
}

import type { ParsedCliInvocation } from '@src/system/parser-cli';
import type { WebNodeRoot } from '@src/web/ui-schema';

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

function toWebArgs(parsed: ParsedCliInvocation): string[] {
  const raw = parsed.arguments.duelArgs;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((value): value is string => typeof value === 'string');
}

export async function adaptDuelCommand(
  params: TodoCommandAdapterParams,
): Promise<string | WebNodeRoot> {
  return await handleDuelCommand({
    args: toArgs(params.parsed),
    webArgs: toWebArgs(params.parsed),
    db: params.db,
    alias: params.alias,
    source: params.source,
    sendReply: params.sendReply,
    promptFn: params.promptFn,
  });
}

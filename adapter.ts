import type { Database } from 'bun:sqlite';

import type {
  PluginIdentity,
  PromptFn,
  RunAgentFn,
  SendReplyFn,
} from '@src/core/plugin';
import type { MessageSource } from '@src/messaging';
import { parseCliInput } from '@src/system/parser-cli';
import type { WebNodeRoot } from '@src/web/ui-schema';

import { adaptAcceptCommand } from './commands/accept/adapter';
import { adaptAddCommand } from './commands/add/adapter';
import { adaptAiCommand } from './commands/ai/adapter';
import { adaptCurrentCommand } from './commands/current/adapter';
import { adaptDeclineCommand } from './commands/decline/adapter';
import { adaptDeleteCommand } from './commands/delete/adapter';
import { adaptDoneCommand } from './commands/done/adapter';
import { adaptDraftsCommand } from './commands/drafts/adapter';
import { adaptDuelCommand } from './commands/duel/adapter';
import { adaptFocusCommand } from './commands/focus/adapter';
import { adaptHelpCommand } from './commands/help/adapter';
import { adaptListCommand } from './commands/list/adapter';
import { adaptMoveCommand } from './commands/move/adapter';
import { adaptNextCommand } from './commands/next/adapter';
import { adaptReviseCommand } from './commands/revise/adapter';
import { adaptShowCommand } from './commands/show/adapter';
import { adaptStartCommand } from './commands/start/adapter';
import { adaptUnfocusCommand } from './commands/unfocus/adapter';
import { adaptUpdateCommand } from './commands/update/adapter';
import { commandDefinition } from './definition';
import type { TodoCommandAdapterParams } from './types/adapter-params';

type TodoSubcommand =
  | 'help'
  | 'ai'
  | 'add'
  | 'drafts'
  | 'accept'
  | 'revise'
  | 'decline'
  | 'duel'
  | 'focus'
  | 'unfocus'
  | 'current'
  | 'next'
  | 'list'
  | 'move'
  | 'done'
  | 'delete'
  | 'show'
  | 'start'
  | 'update';

type MaybePromise<T> = T | Promise<T>;

type TodoCommandAdapter = (
  params: TodoCommandAdapterParams,
) => MaybePromise<string | WebNodeRoot>;

const normalizedDefinitions = new Map<
  string,
  ReturnType<typeof commandDefinition>
>();

const subcommandAdapters: Record<TodoSubcommand, TodoCommandAdapter> = {
  help: adaptHelpCommand,
  ai: adaptAiCommand,
  add: adaptAddCommand,
  drafts: adaptDraftsCommand,
  accept: adaptAcceptCommand,
  revise: adaptReviseCommand,
  decline: adaptDeclineCommand,
  duel: adaptDuelCommand,
  focus: adaptFocusCommand,
  unfocus: adaptUnfocusCommand,
  current: adaptCurrentCommand,
  next: adaptNextCommand,
  list: adaptListCommand,
  move: adaptMoveCommand,
  done: adaptDoneCommand,
  delete: adaptDeleteCommand,
  show: adaptShowCommand,
  start: adaptStartCommand,
  update: adaptUpdateCommand,
};

function getDefinitionKey(prefix: string, alias: string): string {
  return `${prefix}:${alias}`;
}

function getNormalizedDefinition(prefix: string, alias: string) {
  const key = getDefinitionKey(prefix, alias);
  const cached = normalizedDefinitions.get(key);

  if (cached) {
    return cached;
  }

  const normalized = commandDefinition(prefix, alias);

  normalizedDefinitions.set(key, normalized);

  return normalized;
}

function isTodoSubcommand(value: string): value is TodoSubcommand {
  return (
    value === 'help' ||
    value === 'ai' ||
    value === 'add' ||
    value === 'drafts' ||
    value === 'accept' ||
    value === 'revise' ||
    value === 'decline' ||
    value === 'duel' ||
    value === 'focus' ||
    value === 'unfocus' ||
    value === 'current' ||
    value === 'next' ||
    value === 'list' ||
    value === 'move' ||
    value === 'done' ||
    value === 'delete' ||
    value === 'show' ||
    value === 'start' ||
    value === 'update'
  );
}

function unknownSubcommandMessage(params: {
  prefix: string;
  alias: string;
  subcommand: string;
}): string {
  return `Unknown command: ${params.prefix}${params.alias} ${params.subcommand}`;
}

export async function handleTodo(params: {
  args: string[];
  source: MessageSource;
  prefix: string;
  alias: string;
  db: Database;
  identity: PluginIdentity;
  runAgent: RunAgentFn | null;
  helpText: (alias: string, prefix: string) => string[];
  promptFn: PromptFn;
  sendReply: SendReplyFn;
}): Promise<string | WebNodeRoot> {
  const normalizedArgs = params.args.length === 0 ? ['help'] : params.args;
  const subcommand = normalizedArgs[0]?.toLowerCase();

  if (!subcommand || !isTodoSubcommand(subcommand)) {
    return unknownSubcommandMessage({
      prefix: params.prefix,
      alias: params.alias,
      subcommand: subcommand ?? 'unknown',
    });
  }

  try {
    const command = getNormalizedDefinition(params.prefix, params.alias);

    const parsed = parseCliInput({
      command,
      tokens: normalizedArgs,
      rawInput:
        `${params.prefix}${params.alias} ${normalizedArgs.join(' ')}`.trim(),
    });

    if (!isTodoSubcommand(parsed.subcommand)) {
      return unknownSubcommandMessage({
        prefix: params.prefix,
        alias: params.alias,
        subcommand: parsed.subcommand,
      });
    }

    const adapter = subcommandAdapters[parsed.subcommand];

    return await adapter({
      prefix: params.prefix,
      alias: params.alias,
      db: params.db,
      source: params.source,
      parsed,
      command,
      runAgent: params.runAgent,
      sendReply: params.sendReply,
      promptFn: params.promptFn,
    });
  } catch (err) {
    return String(err instanceof Error ? err.message : err);
  }
}

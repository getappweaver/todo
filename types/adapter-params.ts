import type { Database } from 'bun:sqlite';

import type {
  PluginAgentService,
  PromptFn,
  SendReplyFn,
} from '@src/core/plugin';
import type { MessageSource } from '@src/messaging';
import type { CommandDefinition } from '@src/system/command-definition';
import type { ParsedCliInvocation } from '@src/system/parser-cli';

export type TodoCommandAdapterParams = {
  prefix: string;
  alias: string;
  db: Database;
  source: MessageSource;
  parsed: ParsedCliInvocation;
  command: CommandDefinition;
  agent: PluginAgentService;
  sendReply: SendReplyFn;
  promptFn: PromptFn;
};

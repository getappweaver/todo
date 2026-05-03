// ---------------------------------------------------------------------------
// plugins/todo/init.ts — TodoPlugin definition
// ---------------------------------------------------------------------------

import { basename } from 'path';

import type { Database } from 'bun:sqlite';

import {
  parsePluginPackageJson,
  type BotPlugin,
  type PluginInvocationContext,
  type PluginContext,
} from '@src/core/plugin';
import type { WebNodeRoot } from '@src/web/ui-schema';

import { handleTodo } from './adapter';
import { aiDefinition } from './ai';
import { openDb } from './db/open';
import { commandDefinition } from './definition';
import { getTodoHelpLines } from './help';
import { todoStories } from './stories';

const pluginDir = import.meta.dir;
const alias = basename(pluginDir);

const todoPkg = parsePluginPackageJson({ pluginDir });

if (!todoPkg) {
  throw new Error(
    `Todo plugin: invalid or missing package.json. Required: name, version, dmBot.coreApiVersion, dmBot.description`,
  );
}

export let TodoPluginContext: PluginContext | null = null;
export let TodoPluginDb: Database | null = null;

export const TodoPlugin: BotPlugin = {
  identity: {
    name: todoPkg.name,
    alias,
    version: todoPkg.version,
    description: todoPkg.description,
  },
  handler: (
    args: string[],
    context: PluginInvocationContext,
  ): Promise<string | WebNodeRoot> => {
    if (!TodoPluginContext) {
      throw new Error('TodoPlugin not initialized');
    }

    if (!TodoPluginDb) {
      throw new Error('TodoPluginDb not initialized');
    }

    return handleTodo({
      args,
      source: context.source,
      prefix: context.prefix,
      alias,
      db: TodoPluginDb,
      identity: TodoPlugin.identity,
      runAgent: context.runAgent,
      helpText: TodoPlugin.helpText,
      promptFn: context.promptFn ?? TodoPluginContext.promptFn,
      sendReply: context.sendReply ?? TodoPluginContext.sendReply,
    });
  },
  onInit: (ctx: PluginContext) => {
    TodoPluginContext = ctx;
    TodoPluginDb = openDb();
  },
  helpText: (alias: string, prefix: string) => [
    `Todos: nested tasks with pairwise ranking (duel) and status (pending, in progress, done). Use ${prefix}${alias} ai for natural-language drafts (accept/decline/revise); use ${prefix}${alias} add, duel, current, next, and update for direct control.`,
    '',
    `${prefix}${alias} help [subcommand]            — command help`,
    ...getTodoHelpLines(prefix, alias),
  ],
  aiDefinition,
  commandDefinition,
  stories: todoStories,
};

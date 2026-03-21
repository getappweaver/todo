// ---------------------------------------------------------------------------
// plugins/todo/init.ts — TodoPlugin definition
// ---------------------------------------------------------------------------

import { basename } from 'path';

import type { Database } from 'bun:sqlite';

import {
  parsePluginPackageJson,
  type BotPlugin,
  type PluginContext,
} from '@src/core/plugin';

import { handleTodo } from './commands';
import { openDb } from './db';

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
  handler: (args: string[]) => {
    if (!TodoPluginContext) {
      throw new Error('TodoPlugin not initialized');
    }

    if (!TodoPluginDb) {
      throw new Error('TodoPluginDb not initialized');
    }

    return handleTodo({
      args,
      db: TodoPluginDb,
      identity: TodoPlugin.identity,
      runAgent: TodoPluginContext.runAgent,
      helpText: TodoPlugin.helpText,
    });
  },
  onInit: (ctx: PluginContext) => {
    TodoPluginContext = ctx;
    TodoPluginDb = openDb();
  },
  helpText: (alias: string) => [
    `Todos: nested tasks with priorities and status (pending, in progress, done). Use !${alias} ai for natural-language drafts (accept/decline/revise); use !${alias} add, list, done, and update for direct control.`,
    '',
    `!${alias} help — this message`,
    `!${alias} ai <prompt>                  — create a todo draft from natural language`,
    `!${alias} drafts [draft_id]            — list all drafts or show one in detail`,
    `!${alias} accept <draft_id|all>        — confirm a draft and execute it`,
    `!${alias} revise <draft_id> <text>     — note a revision on a pending draft`,
    `!${alias} decline <draft_id>           — discard a draft`,
    `!${alias} add <text>                   — add a top-level todo`,
    `!${alias} add <text> under <parent_id> — add a sub-todo`,
    `!${alias} list [--pending|--done|--all] — list todos as tree (default: pending)`,
    `!${alias} list --flat                  — flat list`,
    `!${alias} list --desc                  — include descriptions in tree`,
    `!${alias} show <id>                    — show todo detail`,
    `!${alias} done <id>                    — mark done (cascades to children)`,
    `!${alias} start <id>                   — set todo to in progress`,
    `!${alias} priority <id> <low|medium|high>`,
    `!${alias} update <id> <field> <value>  — update a field (todo, status, priority, description)`,
    `!${alias} delete <id>                  — delete todo and all descendants`,
  ],
};

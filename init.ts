// ---------------------------------------------------------------------------
// plugins/todos/init.ts — TodoPlugin definition
// ---------------------------------------------------------------------------
import type { Database } from 'bun:sqlite';

import type { BotPlugin } from '@src/core/plugin';

import { handleTodo } from './commands';
import { createTodoTable } from './db';
import { createTodoDraftsTable } from './drafts';

export const TodoPlugin: BotPlugin = {
  identity: {
    name: 'todos',
    alias: 'todo',
    version: '1.0.0',
  },
  handler: (args, ctx) =>
    handleTodo({
      args,
      db: ctx.pluginDb,
      identity: TodoPlugin.identity,
      runAgent: ctx.runAgent,
      helpText: TodoPlugin.helpText,
    }),
  onInit: (db: Database) => {
    createTodoTable(db);
    createTodoDraftsTable(db);
  },
  helpText: (alias: string) => [
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

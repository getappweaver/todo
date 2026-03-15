// ---------------------------------------------------------------------------
// plugins/todos/opencode.ts — OpenCode tool definitions for the todos plugin
//
// Usage: createToolDefinitions(alias) returns the tool definitions array.
// The alias is injected by the code generator reading plugins.json.
//
// Args use tool.schema (opencode's Zod v3) — our own Zod v4 is only used
// inside execute bodies for runtime validation.
// ---------------------------------------------------------------------------

import { join } from 'path';
import { Database } from 'bun:sqlite';
import { tool } from '@opencode-ai/plugin';

import { dmBotRoot } from '../../src/paths';
import { createTodoTable, getTodo, listTodos } from './db';
import { createTodoDraftsTable, storeDraft } from './drafts';
import {
  formatCreateDraftTree,
  formatDraftReply,
  formatTodoTree,
  hasDraftChildren,
} from './format';
import { CreateTodoDraftSchema, UpdateTodoInputSchema } from './types';

// ---------------------------------------------------------------------------
// Arg shapes — tool.schema (opencode's Zod v3)
// ---------------------------------------------------------------------------

const listArgs = {
  filter: tool.schema
    .enum(['pending', 'done', 'all'])
    .optional()
    .describe('Filter by status. Default: pending (active only)'),
  desc: tool.schema
    .boolean()
    .optional()
    .describe('If true, include descriptions in the output'),
};

const createArgs = {
  todo: tool.schema
    .string()
    .min(1)
    .describe('Short title or one-line description of the todo'),
  priority: tool.schema
    .enum(['low', 'medium', 'high'])
    .nullable()
    .describe('Optional priority'),
  description: tool.schema
    .string()
    .nullable()
    .describe('Optional longer notes'),
  tags: tool.schema
    .array(tool.schema.string())
    .nullable()
    .describe('Optional tags e.g. ["work", "personal"]'),
  parent_id: tool.schema
    .number()
    .nullable()
    .optional()
    .describe(
      'ID of an EXISTING parent todo to nest under. ' +
      'Call list first to get the ID. NULL for top-level. ' +
      'Do NOT use children if setting parent_id.'),
  children: tool.schema
    .array(tool.schema.record(tool.schema.string(), tool.schema.unknown()))
    .optional()
    .describe(
      'Nested child todos for creating a NEW tree in one shot. ' +
      'Only use when parent_id is NULL. Never combine with parent_id.'),
  original_prompt: tool.schema
    .string()
    .describe('The original natural language request, verbatim'),
};

const updateArgs = {
  id: tool.schema.number().describe('ID of the todo to update'),
  todo: tool.schema.string().min(1).optional().describe('New title'),
  status: tool.schema
    .enum(['pending', 'in_progress', 'done', 'cancelled'])
    .optional()
    .describe('New status'),
  priority: tool.schema
    .enum(['low', 'medium', 'high'])
    .nullable()
    .optional()
    .describe('New priority'),
  description: tool.schema.string().nullable().optional().describe('New description'),
  tags: tool.schema.array(tool.schema.string()).nullable().optional().describe('New tags'),
  original_prompt: tool.schema
    .string()
    .describe('The original natural language request, verbatim'),
};

const deleteArgs = {
  id: tool.schema.number().int().positive().describe('ID of the todo to delete'),
  original_prompt: tool.schema
    .string()
    .describe('The original natural language request, verbatim'),
};

// ---------------------------------------------------------------------------
// Arg types (manual — can't infer from tool.schema)
// ---------------------------------------------------------------------------

type ListArgs = {
  filter?: 'pending' | 'done' | 'all';
  desc?: boolean;
};

type CreateArgs = {
  todo: string;
  priority?: 'low' | 'medium' | 'high' | null;
  description?: string | null;
  tags?: string[] | null;
  parent_id?: number | null;
  children?: Record<string, unknown>[];
  original_prompt: string;
};

type UpdateArgs = {
  id: number;
  todo?: string;
  status?: 'pending' | 'in_progress' | 'done' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | null;
  description?: string | null;
  tags?: string[] | null;
  original_prompt: string;
};

type DeleteArgs = {
  id: number;
  original_prompt: string;
};

// ---------------------------------------------------------------------------
// Agent instructions — injected into AGENTS.md by the generator
// ---------------------------------------------------------------------------

export function agentInstructions(alias: string): string {
  return `\
## Todo Management (${alias} tools)

When the user asks to create, update, delete, or list todos:
- Always use the ${alias}__* tools — never output JSON directly
- Always show the full tool output to the user exactly as returned, including Draft ID and reply instructions
- Always call ${alias}__list first to resolve todo names to IDs before updating or deleting
- Never guess or assume a todo ID
- The draft/confirm flow is intentional: every mutating operation (create, update, delete) returns a draft that the user must explicitly accept, revise, or decline via the bot command shown in the output
- Never retry a create/update/delete if it returns a Draft ID — the draft was created successfully, just show it to the user
- Never create multiple drafts for the same request`;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createToolDefinitions(alias: string) {
  const dbPath = join(dmBotRoot, 'plugins', alias, 'db.sqlite');
  const cmd = `!${alias}`;

  function openDb(): Database {
    const db = new Database(dbPath);
    db.run('PRAGMA foreign_keys = ON');
    createTodoTable(db);
    createTodoDraftsTable(db);
    return db;
  }

  return [
    {
      name: 'list',
      description:
        'List all current todos with their real IDs and statuses. Always call this first before any update or delete to get correct IDs. Never guess IDs.',
      args: listArgs,
      execute: async (args: ListArgs): Promise<string> => {
        const db = openDb();
        const filter = args.filter ?? 'pending';
        let todos = listTodos(db);

        if (filter === 'pending') {
          todos = todos.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
        } else if (filter === 'done') {
          todos = todos.filter((t) => t.status === 'done');
        }

        if (todos.length === 0) return 'No todos.';
        return formatTodoTree(todos, args.desc ?? false);
      },
    },

    {
      name: 'create',
      description:
        'Propose a new todo for the user to review. IMPORTANT: Always use this tool to create todos — never output JSON directly. The tool will return a draft preview with a Draft ID. Show the full tool output to the user exactly as returned.',
      args: createArgs,
      execute: async (args: CreateArgs): Promise<string> => {
        const db = openDb();

        const parsed = CreateTodoDraftSchema.safeParse(args);
        if (!parsed.success) return `Validation error: ${parsed.error.message}`;

        const draftId = storeDraft(db, {
          kind: 'create',
          input: parsed.data,
          originalPrompt: args.original_prompt,
        });

        const title = hasDraftChildren(parsed.data)
          ? "I'm going to create the following todo tree:"
          : "I'm going to create the following todo item:";

        return [
          title,
          ``,
          formatCreateDraftTree(parsed.data),
          ``,
          `Draft ID: ${draftId}`,
          formatDraftReply(cmd, draftId, 'create'),
        ].join('\n');
      },
    },

    {
      name: 'update',
      description:
        'Propose an update to an existing todo. IMPORTANT: Always use this tool — never output JSON or assume the update succeeded. Show the full tool output (including Draft ID and reply instructions) to the user exactly as returned.',
      args: updateArgs,
      execute: async (args: UpdateArgs): Promise<string> => {
        const db = openDb();

        const { original_prompt, ...updateInput } = args;
        const parsed = UpdateTodoInputSchema.safeParse(updateInput);
        if (!parsed.success) return `Validation error: ${parsed.error.message}`;

        const existing = getTodo(db, parsed.data.id);
        if (!existing) {
          return `Todo not found: ${parsed.data.id}. Call the list tool to see current IDs.`;
        }

        const draftId = storeDraft(db, {
          kind: 'update',
          input: parsed.data,
          originalPrompt: original_prompt,
        });

        const fields = ['todo', 'status', 'priority', 'description', 'tags'] as const;
        const fmt = (v: unknown) =>
          v === null || v === undefined ? '—' : Array.isArray(v) ? v.join(', ') : String(v);
        const lines = fields.map((key) => {
          const current = existing[key];
          const next = (parsed.data as Record<string, unknown>)[key];
          const hasChange = key in parsed.data && next !== undefined;
          return `  ${key.padEnd(12)}: ${hasChange ? `${fmt(current)} → ${fmt(next)}` : fmt(current)}`;
        });

        return [
          `I'm going to update Todo #${existing.id}: "${existing.todo}"`,
          ``,
          ...lines,
          ``,
          `Draft ID: ${draftId}`,
          formatDraftReply(cmd, draftId, 'update'),
        ].join('\n');
      },
    },

    {
      name: 'delete',
      description:
        'Propose deleting a todo. IMPORTANT: Always use this tool. Show the full tool output to the user exactly as returned.',
      args: deleteArgs,
      execute: async (args: DeleteArgs): Promise<string> => {
        const db = openDb();

        const todo = getTodo(db, args.id);
        if (!todo) {
          return `Todo not found: ${args.id}. Call the list tool to see current IDs.`;
        }

        const draftId = storeDraft(db, {
          kind: 'delete',
          input: { id: args.id },
          originalPrompt: args.original_prompt,
        });

        return [
          `I'm going to delete todo "${todo.todo}" (id: ${args.id}) and all its descendants.`,
          ``,
          `Draft ID: ${draftId}`,
          formatDraftReply(cmd, draftId, 'delete'),
        ].join('\n');
      },
    },
  ] as const;
}

export type ToolDefinitions = ReturnType<typeof createToolDefinitions>;
export type ToolDefinition = ToolDefinitions[number];
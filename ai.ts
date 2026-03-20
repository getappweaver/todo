// ---------------------------------------------------------------------------
// todos/ai.ts — AI-powered todo operations via natural language
// ---------------------------------------------------------------------------

import type { Database } from 'bun:sqlite';
import { z } from 'zod';

import type { AgentRunResult } from '@src/backends/types';
import { getOutputString } from '@src/backends/types';
import type { PluginIdentity } from '@src/core/plugin';
import type { ParseSettledResult } from '@src/tools/utils';
import { parseToolCalls } from '@src/tools/utils';

import { getTodo, listTodos } from './db';
import { storeDraft } from './drafts';
import { formatDraftReply } from './format';
import { formatTodoTree } from './format';
import type { CreateTodoDraft } from './types';
import { CreateTodoDraftSchema, UpdateTodoInputSchema } from './types';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const TodoListCallSchema = z.object({
  type: z.literal('list'),
  filter: z.enum(['pending', 'done', 'all']).optional(),
  desc: z.boolean().optional(),
});

const TodoCreateCallSchema = z.object({
  type: z.literal('create'),
  input: CreateTodoDraftSchema,
  original_prompt: z.string(),
});

const TodoUpdateCallSchema = z.object({
  type: z.literal('update'),
  input: UpdateTodoInputSchema,
  original_prompt: z.string(),
});

const TodoDeleteCallSchema = z.object({
  type: z.literal('delete'),
  input: z.object({
    id: z.number().int().positive().describe('ID of the todo to delete'),
  }),
  original_prompt: z.string(),
});

const TodoToolCallSchema = z.discriminatedUnion('type', [
  TodoListCallSchema,
  TodoCreateCallSchema,
  TodoUpdateCallSchema,
  TodoDeleteCallSchema,
]);

export { TodoToolCallSchema as ToolCallSchema };
export const skillDescription = 'Todo management via local dm-bot CLI tools.';

type TodoToolCall = z.infer<typeof TodoToolCallSchema>;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export function buildSystemPrompt(
  userPrompt: string,
  activeTree: string,
): string {
  const schema = z.toJSONSchema(TodoToolCallSchema);

  return `You are managing a todo list for the user. Your output is used by the system to create draft todo items. The user will then review each draft and can accept it (create real todos), decline it, or ask for revisions. Revise applies to the whole draft (e.g. a whole tree), not a single item.

Active todos (pending and in progress):
${activeTree}

User request: "${userPrompt}"

Instructions:
- If the user wants to see todos, output type "list".
- If the user wants to create new todo(s), output type "create". For "create", you must output a single tree: one root node with optional "children" array. Each child has the same shape (todo, priority?, description?, tags?, children?). Use this recursive structure so parent-child relationships are expressed by nesting, not by IDs. One "create" = one tree = one draft. To add multiple unrelated top-level items, output multiple "create" objects (one JSON object per line), each with its own root and optional children.
- If the user wants to update an existing todo, output type "update". Resolve the todo by name from the active list to its numeric id and only include the fields being changed (id plus status, todo, priority, etc. as needed).
- If the user wants to delete a todo, output type "delete".
- For "create", "update", and "delete": include "original_prompt" at the top level (same level as "type"), set to the user's request verbatim.
- Important: "update [todo name] status to X" means update the existing todo — use "update" with that todo's id, not "create".
- For name resolution (update/delete): match by name (case-insensitive, partial match). If ambiguous, pick the closest match.

Output one or more JSON objects matching this JSON Schema. One object per line (JSONL) for multiple operations. No markdown, no code fence, no explanation:

${JSON.stringify(schema, null, 2)}`;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseTodoToolCalls(
  raw: string,
): ParseSettledResult<TodoToolCall>[] {
  return parseToolCalls({ raw, schema: TodoToolCallSchema });
}

// ---------------------------------------------------------------------------
// Preview formatters
// ---------------------------------------------------------------------------

const BULLET = '- ';

function formatDraftTreeLines(node: CreateTodoDraft, prefix: string): string[] {
  const lines: string[] = [];
  const pri = node.priority ? ` [${node.priority}]` : '';

  lines.push(`${prefix}${BULLET}${node.todo}${pri}`);

  const extraIndent = prefix + ' '.repeat(BULLET.length);

  const desc = node.description?.trim();

  if (desc) {
    for (const line of desc.split('\n')) {
      lines.push(`${extraIndent}${line}`);
    }
  }

  if (node.tags?.length) {
    lines.push(`${extraIndent}tags: ${node.tags.join(', ')}`);
  }

  const children = node.children ?? [];

  children.forEach((child: CreateTodoDraft) => {
    lines.push(...formatDraftTreeLines(child, prefix + '  '));
  });

  return lines;
}

function hasDraftChildren(node: CreateTodoDraft): boolean {
  return (node.children?.length ?? 0) > 0;
}

function formatCreatePreview(
  draftId: number,
  call: z.infer<typeof TodoCreateCallSchema>,
  cmd: string,
): string {
  const { input } = call;
  const treeLines = formatDraftTreeLines(input, '  ');

  const title = hasDraftChildren(input)
    ? "I'm going to create the following todo tree:"
    : "I'm going to create the following todo item:";

  return [
    title,
    ``,
    ...treeLines,
    ``,
    `Draft ID: ${draftId}`,
    formatDraftReply(cmd, draftId, 'create'),
  ].join('\n');
}

const UPDATE_PREVIEW_FIELDS: Array<{
  key: keyof z.infer<typeof UpdateTodoInputSchema>;
  label: string;
}> = [
  { key: 'todo', label: 'todo' },
  { key: 'status', label: 'status' },
  { key: 'priority', label: 'priority' },
  { key: 'description', label: 'description' },
  { key: 'tags', label: 'tags' },
];

function formatUpdatePreview(
  draftId: number,
  call: z.infer<typeof TodoUpdateCallSchema>,
  db: Database,
  cmd: string,
): string {
  const { input } = call;
  const existing = getTodo(db, input.id);

  const titleLine = existing
    ? `Todo #${input.id}: "${existing.todo}"`
    : `Todo #${input.id}`;

  const formatVal = (v: string | string[] | null | undefined): string => {
    if (v === undefined || v === null) {
      return '—';
    }

    return Array.isArray(v) ? v.join(', ') : String(v);
  };

  const lines = UPDATE_PREVIEW_FIELDS.map(({ key, label }) => {
    const current = existing
      ? (existing as Record<string, unknown>)[key]
      : undefined;

    const next = (input as Record<string, unknown>)[key];
    const hasChange = key in input && next !== undefined;

    const value = hasChange
      ? `${formatVal(current as string | string[] | null | undefined)} → ${formatVal(next as string | string[] | null | undefined)}`
      : formatVal(current as string | string[] | null | undefined);

    return `  ${label.padEnd(12)}: ${value}`;
  });

  return [
    `I'm going to update ${titleLine}`,
    ``,
    ...lines,
    ``,
    `Draft ID: ${draftId}`,
    formatDraftReply(cmd, draftId, 'update'),
  ].join('\n');
}

function formatDeletePreview(
  draftId: number,
  call: z.infer<typeof TodoDeleteCallSchema>,
  db: Database,
  cmd: string,
): string {
  const todo = getTodo(db, call.input.id);
  const name = todo ? `"${todo.todo}"` : `#${call.input.id}`;

  return [
    `I'm going to delete todo ${name} (id: ${call.input.id}) and all its descendants.`,
    ``,
    `Draft ID: ${draftId}`,
    formatDraftReply(cmd, draftId, 'delete'),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export type HandleTodoAiProps = {
  args: string[];
  db: Database;
  identity: PluginIdentity;
  runAgent: (prompt: string) => Promise<AgentRunResult>;
};

export async function handleTodoAi({
  args,
  db,
  identity,
  runAgent,
}: HandleTodoAiProps): Promise<string> {
  const userPrompt = args.join(' ').trim();

  const alias = identity.alias;

  if (!userPrompt) {
    return `Usage: !${alias} ai <natural language request>\nExample: !${alias} ai add a high priority todo to take medicine tonight at 9PM`;
  }

  const allTodos = listTodos(db);

  const activeTodos = allTodos.filter(
    (t) => t.status !== 'done' && t.status !== 'cancelled',
  );

  const activeTree =
    activeTodos.length > 0
      ? formatTodoTree(activeTodos, false)
      : '(no active todos yet)';

  const systemPrompt = buildSystemPrompt(userPrompt, activeTree);
  const result = await runAgent(systemPrompt);
  const raw = getOutputString(result).trim();

  if (!raw || raw === '(no output)') {
    return 'Model returned no output. Try again or rephrase your request.';
  }

  const results = parseTodoToolCalls(raw);

  const fulfilled = results.filter(
    (r): r is { status: 'fulfilled'; value: TodoToolCall } =>
      r.status === 'fulfilled',
  );

  if (fulfilled.length === 0) {
    const firstRejected = results.find((r) => r.status === 'rejected');

    const msg =
      firstRejected?.status === 'rejected'
        ? firstRejected.reason.message
        : 'No valid JSON';

    return `Failed to parse model response: ${msg}`;
  }

  const calls = fulfilled.map((r) => r.value);

  // list: execute immediately
  if (calls.find((c) => c.type === 'list')) {
    const todos = listTodos(db);
    const listCall = calls.find((c) => c.type === 'list');
    const filter = listCall?.filter ?? 'pending';
    const desc = listCall?.desc ?? false;

    const filtered =
      filter === 'pending'
        ? todos.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
        : filter === 'done'
          ? todos.filter((t) => t.status === 'done')
          : todos;

    return filtered.length === 0
      ? filter === 'done'
        ? 'No done todos.'
        : filter === 'all'
          ? 'No todos.'
          : 'No active todos.'
      : formatTodoTree(filtered, desc);
  }

  // create / update / delete: store drafts and return previews
  const previews: string[] = [];

  const cmd = `!${alias}`;

  for (const call of calls) {
    if (call.type === 'create') {
      const draftId = storeDraft(db, {
        kind: 'create',
        input: call.input,
        originalPrompt: call.original_prompt,
      });

      previews.push(formatCreatePreview(draftId, call, cmd));
    } else if (call.type === 'update') {
      const draftId = storeDraft(db, {
        kind: 'update',
        input: call.input,
        originalPrompt: call.original_prompt,
      });

      previews.push(formatUpdatePreview(draftId, call, db, cmd));
    } else if (call.type === 'delete') {
      const draftId = storeDraft(db, {
        kind: 'delete',
        input: call.input,
        originalPrompt: call.original_prompt,
      });

      previews.push(formatDeletePreview(draftId, call, db, cmd));
    }
  }

  if (previews.length === 0) {
    return 'Unknown operation type returned by model.';
  }

  const acceptAllHint = `You can accept all below by ${cmd} accept all`;

  return [acceptAllHint, ``, previews.join('\n\n')].join('\n');
}

export function agentInstructions(alias: string): string {
  return `## Todo (${alias} tools)

When creating todos:
- One \`create\` call creates exactly one draft (which may contain a full todo tree).
- For parent/child todos, put the entire tree in \`input.children\` inside the same \`create\` call.
- Do NOT create the parent first and then create children separately using \`parent_id\`.
- Each node uses the same shape inside \`children\`:
  { todo, parent_id: null, priority, description, tags, children? }

After the CLI returns, apply the draft using the reply instructions included in the output:
- \`!${alias} accept <draft_id>\`
- \`!${alias} revise <draft_id> <corrections>\`
- \`!${alias} decline <draft_id>\`

Output policy:
- For mutating calls (\`create\`, \`update\`, \`delete\`), return the CLI output to the user verbatim.
- Do NOT summarize, shorten, or replace it with only "Created draft #...".
- The user must see the full draft preview text and reply commands exactly as returned.
`;
}

export async function executeTool({
  alias,
  call,
  db,
}: {
  alias: string;
  call: TodoToolCall;
  db: Database;
}): Promise<string> {
  const cmd = `!${alias}`;

  switch (call.type) {
    case 'list': {
      const todos = listTodos(db);
      const filter = call.filter ?? 'pending';
      const desc = call.desc ?? false;

      const filtered =
        filter === 'pending'
          ? todos.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
          : filter === 'done'
            ? todos.filter((t) => t.status === 'done')
            : todos;

      return filtered.length === 0
        ? filter === 'done'
          ? 'No done todos.'
          : filter === 'all'
            ? 'No todos.'
            : 'No active todos.'
        : formatTodoTree(filtered, desc);
    }

    case 'create': {
      const draftId = storeDraft(db, {
        kind: 'create',
        input: call.input,
        originalPrompt: call.original_prompt,
      });

      return formatCreatePreview(draftId, call, cmd);
    }

    case 'update': {
      const draftId = storeDraft(db, {
        kind: 'update',
        input: call.input,
        originalPrompt: call.original_prompt,
      });

      return formatUpdatePreview(draftId, call, db, cmd);
    }

    case 'delete': {
      const draftId = storeDraft(db, {
        kind: 'delete',
        input: call.input,
        originalPrompt: call.original_prompt,
      });

      return formatDeletePreview(draftId, call, db, cmd);
    }
  }
}

// Re-export so CLI can open the plugin DB without importing init/bot wiring.
export { openDb } from './db';

import type { Database } from 'bun:sqlite';
import type { z } from 'zod';

import { createDraftSessionId, storeDraft } from '../db/drafts';
import { openDb } from '../db/open';
import { getTodo, listTodos, listTodosInSubtree } from '../db/todos';
import { formatDraftReply, hasDraftChildren } from '../output/draft/format';
import {
  filterTodosForListTool,
  formatTodoTree,
} from '../output/todo-tree/format';
import type { CreateTodoDraft } from '../types/drafts';
import type { TodoStatus } from '../types/todos';

import type {
  TodoCreateCallSchema,
  TodoDeleteCallSchema,
  TodoToolCall,
  TodoUpdateCallSchema,
} from './schema';

function emptyTodoListMessage(filter: TodoStatus[] | undefined): string {
  if (filter === undefined) {
    return 'No active todos.';
  }

  if (filter.length === 1 && filter[0] === 'done') {
    return 'No done todos.';
  }

  return 'No todos matching filter.';
}

const BULLET = '- ';

function formatDraftTreeLines(node: CreateTodoDraft, prefix: string): string[] {
  const lines: string[] = [];
  lines.push(`${prefix}${BULLET}${node.todo}`);

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

  for (const child of node.children ?? []) {
    lines.push(...formatDraftTreeLines(child, prefix + '  '));
  }

  return lines;
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
    '',
    ...treeLines,
    '',
    `Draft ID: ${draftId}`,
    formatDraftReply(cmd, draftId, 'create'),
  ].join('\n');
}

const UPDATE_PREVIEW_FIELDS: Array<{
  key: keyof z.infer<typeof TodoUpdateCallSchema>['input'];
  label: string;
}> = [
  { key: 'todo', label: 'todo' },
  { key: 'status', label: 'status' },
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

  const formatVal = (value: string | string[] | null | undefined): string => {
    if (value === undefined || value === null) {
      return '—';
    }

    return Array.isArray(value) ? value.join(', ') : String(value);
  };

  const lines = UPDATE_PREVIEW_FIELDS.map(({ key, label }) => {
    const current = existing
      ? (existing as Record<string, unknown>)[String(key)]
      : undefined;

    const next = (input as Record<string, unknown>)[String(key)];
    const hasChange = key in input && next !== undefined;

    const value = hasChange
      ? `${formatVal(current as string | string[] | null | undefined)} -> ${formatVal(next as string | string[] | null | undefined)}`
      : formatVal(current as string | string[] | null | undefined);

    return `  ${label.padEnd(12)}: ${value}`;
  });

  return [
    `I'm going to update ${titleLine}`,
    '',
    ...lines,
    '',
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
    '',
    `Draft ID: ${draftId}`,
    formatDraftReply(cmd, draftId, 'delete'),
  ].join('\n');
}

export function agentInstructions(alias: string): string {
  return `## Todo (${alias} tools)

When creating todos:
- One \`create\` call creates exactly one draft (which may contain a full todo tree).
- For parent/child todos, put the entire tree in \`input.children\` inside the same \`create\` call.
- Do NOT create the parent first and then create children separately using \`parent_id\`.
- Each node uses the same shape inside \`children\`:
  { todo, parent_id: null, description, tags, children? }

After the CLI returns, apply the draft using the reply instructions included in the output:
- \`!${alias} accept <draft_id>\`
- \`!${alias} revise <draft_id> <corrections>\`
- \`!${alias} decline <draft_id>\`

List policy:
- For \`list\`, omit \`filter\` for active todos (\`pending\` + \`in_progress\`; not \`done\` or \`cancelled\`), same as \`!${alias} list\` with no filter. If \`filter\` is set, it must be a non-empty array of statuses to include (e.g. \`["in_progress"]\`, \`["done"]\`, or all four for everything). Combine statuses as needed.
- If the user mentions a todo by copied ID (for example \`#154\`) and you need its context before answering or mutating, call \`list\` with \`id: 154\` first. ID-scoped \`list\` returns that todo and its visible subtree; use \`desc: true\` when descriptions matter.

Output policy:
- For \`list\`, return the tool output verbatim. Lines use a checkbox prefix (\`[ ]\`, \`[~]\`, etc.) and tree lines end with \`(id: N)\`. Do not rewrite into your own bullets, do not move IDs into backticks, and do not drop the checkboxes.
- For mutating calls (\`create\`, \`update\`, \`delete\`), return the CLI output to the user verbatim.
- Do NOT summarize, shorten, or replace it with only "Created draft #...".
- The user must see the full draft preview text and reply commands exactly as returned.
`;
}

export async function executeTool(params: {
  alias: string;
  call: TodoToolCall;
  db: Database;
}): Promise<string> {
  const cmd = `!${params.alias}`;

  switch (params.call.type) {
    case 'list': {
      const rootId = params.call.id;

      if (rootId !== undefined && !getTodo(params.db, rootId)) {
        return `Todo not found: #${rootId}`;
      }

      const todos =
        rootId === undefined
          ? listTodos(params.db)
          : listTodosInSubtree(params.db, rootId);

      const statusFilter = params.call.filter;
      const desc = params.call.desc ?? false;

      const filtered =
        rootId === undefined || statusFilter !== undefined
          ? filterTodosForListTool(todos, statusFilter)
          : todos;

      return filtered.length === 0
        ? emptyTodoListMessage(statusFilter)
        : formatTodoTree(filtered, desc, rootId);
    }

    case 'create': {
      const draftId = storeDraft(params.db, {
        sessionId: createDraftSessionId(),
        kind: 'create',
        input: params.call.input,
        originalPrompt: params.call.original_prompt,
      });

      return formatCreatePreview(draftId, params.call, cmd);
    }

    case 'update': {
      const draftId = storeDraft(params.db, {
        sessionId: createDraftSessionId(),
        kind: 'update',
        input: params.call.input,
        originalPrompt: params.call.original_prompt,
      });

      return formatUpdatePreview(draftId, params.call, params.db, cmd);
    }

    case 'delete': {
      const draftId = storeDraft(params.db, {
        sessionId: createDraftSessionId(),
        kind: 'delete',
        input: params.call.input,
        originalPrompt: params.call.original_prompt,
      });

      return formatDeletePreview(draftId, params.call, params.db, cmd);
    }
  }
}

export { openDb };

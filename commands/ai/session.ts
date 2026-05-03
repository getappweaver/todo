import type { Database } from 'bun:sqlite';

import type { AgentRunResult } from '@src/backends/types';
import { getOutputString } from '@src/backends/types';
import type { PromptFn, RunAgentFn } from '@src/core/plugin';
import type { MessageSource } from '@src/messaging';
import { PROMPT_SESSION_EXIT } from '@src/prompt-session';

import { parseTodoToolCalls } from '../../ai/parse';
import { buildSystemPrompt } from '../../ai/prompt';
import type { TodoToolCall } from '../../ai/schema';
import {
  deleteDraft,
  getDraftBySessionIndex,
  listDraftsBySession,
  updateDraftEntry,
  type TodoDraftRow,
} from '../../db/drafts';
import {
  createTodosFromDraftTree,
  deleteTodo,
  getTodo,
  listTodos,
  updateTodo,
} from '../../db/todos';
import {
  formatCreateDraftTree,
  hasDraftChildren,
} from '../../output/draft/format';
import { formatTodoDetail } from '../../output/todo-detail/format';
import {
  formatTodoTree,
  isActiveListTodo,
} from '../../output/todo-tree/format';

import { createTodoDraftReviewPrompt } from './renderers/web';

function formatDraftTodoDetail(params: {
  db: Database;
  id: number;
  todo: string;
  parentId: number | null;
  tags: string[] | null;
  description: string | null;
  createdAt: number;
}): string {
  const parentLabel =
    params.parentId === null
      ? '(top-level)'
      : (() => {
          const parent = getTodo(params.db, params.parentId);

          return parent
            ? `#${params.parentId} (${parent.todo})`
            : `#${params.parentId}`;
        })();

  return [
    `ID:          ${params.id}`,
    `Todo:        ${params.todo}`,
    'Status:      pending',
    `Parent:      ${parentLabel}`,
    `Tags:        ${params.tags?.join(', ') ?? '—'}`,
    `Description: ${params.description ?? '—'}`,
    `Created:     ${new Date(params.createdAt).toLocaleString()}`,
    'Updated:     —',
    'Completed:   —',
  ].join('\n');
}

function formatDraftPreview(db: Database, draft: TodoDraftRow): string {
  if (draft.kind === 'create') {
    const title = hasDraftChildren(draft.input)
      ? 'Current Draft Details (root item):'
      : 'Current Draft Details:';

    const details = formatDraftTodoDetail({
      db,
      id: draft.id,
      todo: draft.input.todo,
      parentId: draft.input.parent_id,
      tags: draft.input.tags,
      description: draft.input.description,
      createdAt: draft.createdAt,
    });

    if (!hasDraftChildren(draft.input)) {
      return [title, '', details].join('\n');
    }

    return [
      title,
      '',
      details,
      '',
      'Children:',
      formatCreateDraftTree({ ...draft.input, children: draft.input.children }),
    ].join('\n');
  }

  if (draft.kind === 'update') {
    const existing = getTodo(db, draft.input.id);

    const titleLine = existing
      ? 'Current Draft Details:'
      : `Current Draft Details:\nTarget: #${draft.input.id}`;

    const fields = Object.entries(draft.input)
      .filter(([key, value]) => key !== 'id' && value !== undefined)
      .map(([key, value]) => {
        const next =
          value === null
            ? '—'
            : Array.isArray(value)
              ? value.join(', ')
              : String(value);

        const current =
          existing &&
          (key === 'todo' ||
            key === 'status' ||
            key === 'description' ||
            key === 'tags')
            ? (existing as Record<string, unknown>)[key]
            : undefined;

        const currentText =
          current === undefined || current === null
            ? '—'
            : Array.isArray(current)
              ? current.join(', ')
              : String(current);

        return `  ${key.padEnd(12)}: ${currentText} -> ${next}`;
      });

    return [
      titleLine,
      existing ? formatTodoDetail(existing) : '',
      '',
      'Changes:',
      ...fields,
    ]
      .filter((line) => line.length > 0)
      .join('\n');
  }

  const todo = getTodo(db, draft.input.id);
  const label = todo ? `"${todo.todo}"` : `#${draft.input.id}`;

  return [
    'Current Draft Details:',
    todo ? formatTodoDetail(todo) : `Target: ${label}`,
    '',
    `Action: delete todo ${label} (id: ${draft.input.id}) and all descendants.`,
  ].join('\n');
}

export function renderDraftSessionReview(params: {
  prefix: string;
  alias: string;
  db: Database;
  sessionId: string;
  index: number;
}): string {
  const drafts = listDraftsBySession(params.db, params.sessionId);

  if (drafts.length === 0) {
    return 'Session complete. No drafts remaining.';
  }

  if (params.index >= drafts.length) {
    return `Session finished. ${drafts.length} skipped draft(s) remain. Review them later with ${params.prefix}${params.alias} drafts.`;
  }

  const draft = drafts[params.index]!;

  return [
    `AI draft review ${params.index + 1}/${drafts.length}`,
    `Current Draft: #${draft.id} [${draft.kind}]`,
    '',
    formatDraftPreview(params.db, draft),
    '',
    'a=accept, r=revise, d=decline, s=skip, q=quit',
  ].join('\n');
}

async function reviseCreateDraft(params: {
  db: Database;
  draft: TodoDraftRow;
  corrections: string;
  runAgent: (prompt: string) => Promise<AgentRunResult>;
}): Promise<string | null> {
  if (params.draft.kind !== 'create') {
    return `Draft #${params.draft.id} is a ${params.draft.kind} draft and cannot be revised interactively yet.`;
  }

  const activeTodos = listTodos(params.db).filter(isActiveListTodo);

  const activeTree =
    activeTodos.length > 0
      ? formatTodoTree(activeTodos, false)
      : '(no active todos)';

  const revisedPrompt = `Revise the following todo: "${params.draft.input.todo}". Correction: "${params.corrections}".`;

  const raw = getOutputString(
    await params.runAgent(buildSystemPrompt(revisedPrompt, activeTree)),
  );

  if (!raw || raw === '(no output)') {
    return 'AI returned no output while revising the draft.';
  }

  const fulfilled = parseTodoToolCalls(raw).filter(
    (result): result is { status: 'fulfilled'; value: TodoToolCall } =>
      result.status === 'fulfilled',
  );

  if (fulfilled.length !== 1) {
    return 'AI revise must return exactly one valid tool call.';
  }

  const call = fulfilled[0].value;

  if (call.type !== 'create') {
    return 'AI revise must return a create draft for interactive revision.';
  }

  updateDraftEntry(params.db, params.draft.id, {
    kind: 'create',
    input: call.input,
    originalPrompt: `${params.draft.originalPrompt} (revised: ${params.corrections})`,
  });

  return null;
}

export async function applyDraftSessionAction(params: {
  prefix: string;
  alias: string;
  db: Database;
  sessionId: string;
  index: number;
  action: 'accept' | 'revise' | 'decline' | 'skip' | 'quit';
  input?: string;
  runAgent?: RunAgentFn;
}): Promise<string> {
  if (params.action === 'quit') {
    return `Session finished. Remaining drafts can be reviewed later with ${params.prefix}${params.alias} drafts.`;
  }

  const draft = getDraftBySessionIndex(
    params.db,
    params.sessionId,
    params.index,
  );

  if (!draft) {
    return renderDraftSessionReview(params);
  }

  if (params.action === 'skip') {
    return renderDraftSessionReview({ ...params, index: params.index + 1 });
  }

  if (params.action === 'decline') {
    deleteDraft(params.db, draft.id);

    return renderDraftSessionReview(params);
  }

  if (params.action === 'revise') {
    if (!params.runAgent) {
      return 'Revise requires an agent backend.';
    }

    const corrections = params.input?.trim();

    if (!corrections) {
      return 'Revise requires correction text.';
    }

    const error = await reviseCreateDraft({
      db: params.db,
      draft,
      corrections,
      runAgent: params.runAgent,
    });

    if (error) {
      return error;
    }

    return renderDraftSessionReview(params);
  }

  if (draft.kind === 'create') {
    const created = createTodosFromDraftTree(params.db, draft.input, 'dm');
    deleteDraft(params.db, draft.id);

    return [
      created.length === 1
        ? `Accepted draft #${draft.id}.\nTodo created: #${created[0].id}\n${formatTodoDetail(created[0])}`
        : `Accepted draft #${draft.id}. Created ${created.length} todos.`,
      '',
      renderDraftSessionReview(params),
    ].join('\n');
  }

  if (draft.kind === 'update') {
    const updated = updateTodo(params.db, draft.input);
    deleteDraft(params.db, draft.id);

    return [
      updated
        ? `Accepted draft #${draft.id}.\nTodo updated.\n${formatTodoDetail(updated)}`
        : `Todo not found: #${draft.input.id}`,
      '',
      renderDraftSessionReview(params),
    ].join('\n');
  }

  const todo = getTodo(params.db, draft.input.id);
  const label = todo ? `"${todo.todo}"` : `#${draft.input.id}`;
  const deleted = deleteTodo(params.db, draft.input.id);
  deleteDraft(params.db, draft.id);

  return [
    deleted
      ? `Accepted draft #${draft.id}.\nTodo ${label} (id: #${draft.input.id}) deleted (and all descendants).`
      : `Todo not found: #${draft.input.id}`,
    '',
    renderDraftSessionReview(params),
  ].join('\n');
}

function parseInteractiveAction(input: string): {
  action: 'accept' | 'revise' | 'decline' | 'skip' | 'quit' | null;
  text: string;
} {
  const trimmed = input.trim();
  const [head, ...rest] = trimmed.split(/\s+/);
  const actionRaw = head?.toLowerCase() ?? '';
  const text = rest.join(' ').trim();

  const action =
    actionRaw === 'a' || actionRaw === 'accept'
      ? 'accept'
      : actionRaw === 'r' || actionRaw === 'revise'
        ? 'revise'
        : actionRaw === 'd' || actionRaw === 'decline'
          ? 'decline'
          : actionRaw === 's' || actionRaw === 'skip'
            ? 'skip'
            : actionRaw === 'q' || actionRaw === 'quit'
              ? 'quit'
              : null;

  return { action, text };
}

export async function runAiDraftReviewSession(params: {
  prefix: string;
  alias: string;
  db: Database;
  sessionId: string;
  source: MessageSource;
  runAgent: RunAgentFn;
  promptFn: PromptFn;
}): Promise<string> {
  let index = 0;

  while (true) {
    const view = renderDraftSessionReview({
      prefix: params.prefix,
      alias: params.alias,
      db: params.db,
      sessionId: params.sessionId,
      index,
    });

    if (
      view === 'Session complete. No drafts remaining.' ||
      view.startsWith('Session finished.')
    ) {
      return view;
    }

    const answer = await params.promptFn(
      createTodoDraftReviewPrompt({
        source: params.source,
        command: params.alias,
        subcommand: 'ai',
        text: view,
      }),
    );

    if (answer === PROMPT_SESSION_EXIT) {
      return `Session finished. Remaining drafts can be reviewed later with ${params.prefix}${params.alias} drafts.`;
    }

    const parsed = parseInteractiveAction(answer);

    if (!parsed.action) {
      continue;
    }

    const result = await applyDraftSessionAction({
      prefix: params.prefix,
      alias: params.alias,
      db: params.db,
      sessionId: params.sessionId,
      index,
      action: parsed.action,
      input: parsed.text,
      runAgent: params.runAgent,
    });

    if (parsed.action === 'quit') {
      return result;
    }

    if (
      result === 'Session complete. No drafts remaining.' ||
      result.startsWith('Session finished.')
    ) {
      return result;
    }

    if (parsed.action === 'skip') {
      index += 1;
    }
  }
}

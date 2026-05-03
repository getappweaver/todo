import type { Database } from 'bun:sqlite';

import { getOutputString } from '@src/backends/types';
import type { RunAgentFn } from '@src/core/plugin';

import { parseTodoToolCalls } from '../../ai/parse';
import { buildSystemPrompt } from '../../ai/prompt';
import { formatCreateDraftPreview } from '../../output/draft/format';
import {
  formatTodoTree,
  isActiveListTodo,
} from '../../output/todo-tree/format';

import {
  createTodoDraftSessionId,
  deleteTodoDraft,
  getTodoDraft,
  listAllTodos,
  storeTodoDraft,
} from './db';

function parseOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function parseRequiredText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    const parts = value.filter(
      (item): item is string => typeof item === 'string',
    );

    const text = parts.join(' ').trim();

    return text || null;
  }

  return null;
}

export type ReviseCommandResult =
  | { type: 'error'; message: string }
  | { type: 'success'; message: string };

export async function handleReviseCommand(params: {
  prefix: string;
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
  runAgent: RunAgentFn | null;
}): Promise<ReviseCommandResult> {
  const draftId = parseOptionalInteger(params.arguments.id);
  const corrections = parseRequiredText(params.arguments.corrections);

  if (draftId === null || !corrections) {
    return {
      type: 'error',
      message: `Usage: ${params.prefix}${params.alias} revise <draft_id> <corrections>`,
    };
  }

  const draft = getTodoDraft(params.db, draftId);

  if (!draft) {
    return {
      type: 'error',
      message: `Draft not found: #${draftId}`,
    };
  }

  if (draft.kind !== 'create') {
    return {
      type: 'error',
      message: `Draft #${draftId} is a ${draft.kind} draft. Use !${params.alias} decline ${draftId} and create a new one with the correction applied.`,
    };
  }

  const activeTodos = listAllTodos(params.db).filter(isActiveListTodo);

  const activeTree =
    activeTodos.length > 0
      ? formatTodoTree(activeTodos, false)
      : '(no active todos)';

  const revisedPrompt = `Revise the following todo: "${draft.input.todo}". Correction: "${corrections}".`;

  if (!params.runAgent) {
    return {
      type: 'error',
      message: 'AI not available.',
    };
  }

  const raw = getOutputString(
    await params.runAgent(buildSystemPrompt(revisedPrompt, activeTree)),
  );

  if (!raw || raw === '(no output)') {
    return {
      type: 'error',
      message:
        'AI returned no output. Try running: !todo-ai <revised description>',
    };
  }

  const results = parseTodoToolCalls(raw);
  const fulfilled = results.filter((result) => result.status === 'fulfilled');

  if (fulfilled.length !== 1) {
    const firstRejected = results.find(
      (result) => result.status === 'rejected',
    );

    const msg =
      firstRejected?.status === 'rejected'
        ? firstRejected.reason.message
        : 'Expected exactly one tool call';

    return {
      type: 'error',
      message: `Failed to parse AI response: ${msg}. Try running: !todo-ai <revised description>`,
    };
  }

  const call = fulfilled[0].value;

  if (call.type !== 'create') {
    return {
      type: 'error',
      message:
        'AI did not return a create command. Try running: !todo-ai <revised description>',
    };
  }

  const newDraftId = storeTodoDraft(params.db, {
    sessionId: createTodoDraftSessionId(),
    kind: 'create',
    input: call.input,
    originalPrompt: `${draft.originalPrompt} (revised: ${corrections})`,
  });

  deleteTodoDraft(params.db, draftId);

  const cmd = `!${params.alias}`;

  return {
    type: 'success',
    message: [
      `Draft #${draftId} revised. Created new draft #${newDraftId}:`,
      '',
      formatCreateDraftPreview({
        draftId: newDraftId,
        input: call.input,
        cmd,
      }),
      '',
      `To accept the revised draft: ${cmd} accept ${newDraftId}`,
      `To decline the revised draft: ${cmd} decline ${newDraftId}`,
    ].join('\n'),
  };
}

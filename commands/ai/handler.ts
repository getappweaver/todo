import type { Database } from 'bun:sqlite';

import { getOutputString } from '@src/backends/types';
import type { PluginAgentService } from '@src/core/plugin';

import { runTodoAgent } from '../../agent';
import { parseTodoToolCalls } from '../../ai/parse';
import { buildSystemPrompt } from '../../ai/prompt';
import type { TodoToolCall } from '../../ai/schema';
import { createDraftSessionId, storeDraft } from '../../db/drafts';
import { listTodos } from '../../db/todos';
import {
  filterTodosForListTool,
  formatTodoTree,
  isActiveListTodo,
} from '../../output/todo-tree/format';
import { getTodoAiSettings, saveTodoAiSettings } from '../../settings';
import type { TodoStatus } from '../../types/todos';

type AiListResult = {
  type: 'list';
  text: string;
};

type AiReviewSessionResult = {
  type: 'review_session';
  sessionId: string;
};

type AiErrorResult = {
  type: 'error';
  message: string;
};

export type AiCommandResult =
  AiListResult | AiReviewSessionResult | AiErrorResult;

function parsePromptArgument(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .join(' ')
      .trim();
  }

  return typeof value === 'string' ? value.trim() : '';
}

function emptyTodoListMessage(filter: TodoStatus[] | undefined): string {
  if (filter === undefined) {
    return 'No active todos.';
  }

  if (filter.length === 1 && filter[0] === 'done') {
    return 'No done todos.';
  }

  return 'No todos matching filter.';
}

export async function handleAiCommand(params: {
  prefix: string;
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
  options: Record<string, unknown>;
  agent: PluginAgentService;
}): Promise<AiCommandResult> {
  const userPrompt = parsePromptArgument(params.arguments.prompt);

  if (!userPrompt) {
    return {
      type: 'error',
      message: `Usage: ${params.prefix}${params.alias} ai <natural language request>`,
    };
  }

  const allTodos = listTodos(params.db);
  const activeTodos = allTodos.filter(isActiveListTodo);

  const activeTree =
    activeTodos.length > 0
      ? formatTodoTree(activeTodos, false)
      : '(no active todos yet)';

  const currentSettings = getTodoAiSettings(params.db);
  const hasSelectionUpdate = params.options.save_selections === true;

  if (hasSelectionUpdate) {
    saveTodoAiSettings(params.db, {
      ...currentSettings,
      includeUserInstructions:
        params.options.include_user_instructions === true,
      runtimeContext: params.options.runtime_context === true,
      workspaceInstructions: params.options.workspace_instructions === true,
      agentsInstructions: params.options.agents_instructions === true,
    });
  }

  const result = await runTodoAgent({
    agent: params.agent,
    prompt: buildSystemPrompt(userPrompt, activeTree),
    db: params.db,
  });

  const raw = getOutputString(result).trim();

  if (!raw || raw === '(no output)') {
    return {
      type: 'error',
      message: 'Model returned no output. Try again or rephrase your request.',
    };
  }

  const settled = parseTodoToolCalls(raw);

  const fulfilled = settled.filter(
    (entry): entry is { status: 'fulfilled'; value: TodoToolCall } =>
      entry.status === 'fulfilled',
  );

  if (fulfilled.length === 0) {
    const firstRejected = settled.find((entry) => entry.status === 'rejected');

    const message =
      firstRejected?.status === 'rejected'
        ? firstRejected.reason.message
        : 'No valid JSON';

    return {
      type: 'error',
      message: `Failed to parse model response: ${message}`,
    };
  }

  const calls = fulfilled.map((entry) => entry.value);
  const listCall = calls.find((call) => call.type === 'list');

  if (listCall?.type === 'list') {
    const statusFilter = listCall.filter;
    const desc = listCall.desc ?? false;
    const filtered = filterTodosForListTool(allTodos, statusFilter);

    return {
      type: 'list',
      text:
        filtered.length === 0
          ? emptyTodoListMessage(statusFilter)
          : formatTodoTree(filtered, desc),
    };
  }

  const sessionId = createDraftSessionId();

  for (const call of calls) {
    if (call.type === 'create') {
      storeDraft(params.db, {
        sessionId,
        kind: 'create',
        input: call.input,
        originalPrompt: call.original_prompt,
      });

      continue;
    }

    if (call.type === 'update') {
      storeDraft(params.db, {
        sessionId,
        kind: 'update',
        input: call.input,
        originalPrompt: call.original_prompt,
      });

      continue;
    }

    if (call.type === 'delete') {
      storeDraft(params.db, {
        sessionId,
        kind: 'delete',
        input: call.input,
        originalPrompt: call.original_prompt,
      });
    }
  }

  return {
    type: 'review_session',
    sessionId,
  };
}

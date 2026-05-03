import type { Database } from 'bun:sqlite';

import {
  formatAcceptedAllDraftsResult,
  formatAcceptedCreateDraftResult,
} from '../../output/draft/format';
import { formatTodoDetail } from '../../output/todo-detail/format';

import {
  createTodosFromDraft,
  deleteTodoDraft,
  deleteTodoFromDraft,
  getTodoById,
  getTodoDraft,
  listTodoDrafts,
  updateTodoFromDraft,
} from './db';

function parseRequiredString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

export type AcceptCommandResult =
  | { type: 'error'; message: string }
  | { type: 'success'; message: string };

export function handleAcceptCommand(params: {
  prefix: string;
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
}): AcceptCommandResult {
  const target =
    parseRequiredString(params.arguments.target)?.toLowerCase() ?? null;

  if (!target) {
    return {
      type: 'error',
      message: `Usage: ${params.prefix}${params.alias} accept <draft_id> | ${params.prefix}${params.alias} accept all`,
    };
  }

  if (target === 'all') {
    const drafts = listTodoDrafts(params.db);

    if (drafts.length === 0) {
      return {
        type: 'success',
        message: 'No pending drafts.',
      };
    }

    const results: string[] = [];
    const errors: string[] = [];

    for (const draft of drafts) {
      switch (draft.kind) {
        case 'create': {
          deleteTodoDraft(params.db, draft.id);
          const created = createTodosFromDraft(params.db, draft);

          if (created.length === 1) {
            results.push(`#${created[0].id} ${created[0].todo}`);
          } else {
            const childCount = created.length - 1;

            results.push(
              `#${created[0].id} ${created[0].todo} (+ ${childCount} ${childCount === 1 ? 'child' : 'children'})`,
            );
          }

          break;
        }

        case 'update': {
          deleteTodoDraft(params.db, draft.id);
          const updated = updateTodoFromDraft(params.db, draft);

          if (!updated) {
            errors.push(
              `Draft #${draft.id}: todo #${draft.input.id} not found — skipped`,
            );
          } else {
            results.push(`#${updated.id} updated`);
          }

          break;
        }

        case 'delete': {
          deleteTodoDraft(params.db, draft.id);

          if (!deleteTodoFromDraft(params.db, draft)) {
            errors.push(
              `Draft #${draft.id}: todo #${draft.input.id} not found — skipped`,
            );
          } else {
            results.push(`#${draft.input.id} deleted`);
          }

          break;
        }
      }
    }

    return {
      type: 'success',
      message: formatAcceptedAllDraftsResult({ results, errors }),
    };
  }

  const draftId = Number.parseInt(target, 10);

  if (Number.isNaN(draftId)) {
    return {
      type: 'error',
      message: `Usage: ${params.prefix}${params.alias} accept <draft_id> | ${params.prefix}${params.alias} accept all`,
    };
  }

  const draft = getTodoDraft(params.db, draftId);

  if (!draft) {
    return {
      type: 'error',
      message: `Draft not found: #${draftId}`,
    };
  }

  if (draft.kind === 'create') {
    const created = createTodosFromDraft(params.db, draft);

    deleteTodoDraft(params.db, draftId);

    return {
      type: 'success',
      message: formatAcceptedCreateDraftResult(created),
    };
  }

  deleteTodoDraft(params.db, draftId);

  if (draft.kind === 'update') {
    const updated = updateTodoFromDraft(params.db, draft);

    if (!updated) {
      return {
        type: 'error',
        message: `Todo not found: #${draft.input.id}`,
      };
    }

    return {
      type: 'success',
      message: `Todo updated.\n${formatTodoDetail(updated)}`,
    };
  }

  const todo = getTodoById(params.db, draft.input.id);
  const label = todo ? `"${todo.todo}"` : `#${draft.input.id}`;

  if (!deleteTodoFromDraft(params.db, draft)) {
    return {
      type: 'error',
      message: `Todo not found: #${draft.input.id}`,
    };
  }

  return {
    type: 'success',
    message: `Todo ${label} (id: #${draft.input.id}) deleted (and all descendants).`,
  };
}

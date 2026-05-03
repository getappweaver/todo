import type { Database } from 'bun:sqlite';

import { formatDraftBlock, formatDraftDetail } from '../../output/draft/format';

import { getTodoById, getTodoDraft, listTodoDrafts } from './db';

function parseOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

export type DraftsCommandResult =
  | { type: 'error'; message: string }
  | { type: 'success'; text: string };

export function handleDraftsCommand(params: {
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
  prefix: string;
}): DraftsCommandResult {
  const id = parseOptionalInteger(params.arguments.id);
  const cmd = `${params.prefix}${params.alias}`;

  if (id !== null) {
    const draft = getTodoDraft(params.db, id);

    if (!draft) {
      return {
        type: 'error',
        message: `Draft not found: #${id}`,
      };
    }

    const currentTodo =
      draft.kind === 'create' ? null : getTodoById(params.db, draft.input.id);

    return {
      type: 'success',
      text: formatDraftDetail({
        draft,
        cmd,
        currentTodo,
      }),
    };
  }

  const drafts = listTodoDrafts(params.db);

  if (drafts.length === 0) {
    return {
      type: 'success',
      text: 'No pending drafts.',
    };
  }

  const blocks = drafts.map((draft) =>
    formatDraftBlock({
      draft,
      cmd,
      currentTodo:
        draft.kind === 'create' ? null : getTodoById(params.db, draft.input.id),
    }),
  );

  return {
    type: 'success',
    text: [
      `Pending drafts (${drafts.length}):`,
      '',
      `You can accept all below by ${cmd} accept all`,
      '',
      blocks.join('\n\n'),
    ].join('\n'),
  };
}

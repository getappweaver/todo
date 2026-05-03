import type { Database } from 'bun:sqlite';

import { deleteTodoDraft, getTodoDraft } from './db';

function parseOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

export type DeclineCommandResult =
  | { type: 'error'; message: string }
  | { type: 'success'; message: string };

export function handleDeclineCommand(params: {
  prefix: string;
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
}): DeclineCommandResult {
  const draftId = parseOptionalInteger(params.arguments.id);

  if (draftId === null) {
    return {
      type: 'error',
      message: `Usage: ${params.prefix}${params.alias} decline <draft_id>`,
    };
  }

  if (!getTodoDraft(params.db, draftId)) {
    return {
      type: 'error',
      message: `Draft not found: ${draftId}`,
    };
  }

  deleteTodoDraft(params.db, draftId);

  return {
    type: 'success',
    message: `Draft ${draftId} discarded.`,
  };
}

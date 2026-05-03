import type { Database } from 'bun:sqlite';

import { getTodo, setFocusId } from './db';

function parseOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

export type FocusCommandResult =
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'success';
      message: string;
      rootId: number;
      rootTitle: string;
    };

export function handleFocusCommand(params: {
  prefix: string;
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
}): FocusCommandResult {
  const id = parseOptionalInteger(params.arguments.id);

  if (id === null) {
    return {
      type: 'error',
      message: `Usage: ${params.prefix}${params.alias} focus <id>`,
    };
  }

  const todo = getTodo(params.db, id);

  if (!todo) {
    return {
      type: 'error',
      message: `Todo not found: #${id}`,
    };
  }

  setFocusId(params.db, id);

  const rootTitle = todo.todo.replace(/\s+/g, ' ').trim() || '(unknown)';

  return {
    type: 'success',
    message: `Focus set to #${id}: ${todo.todo}`,
    rootId: id,
    rootTitle,
  };
}

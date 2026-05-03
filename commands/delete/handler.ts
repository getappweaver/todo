import type { Database } from 'bun:sqlite';

import { deleteTodo } from './db';

function parseOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

export type DeleteCommandResult =
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'success';
      message: string;
    };

export function handleDeleteCommand(params: {
  prefix: string;
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
}): DeleteCommandResult {
  const id = parseOptionalInteger(params.arguments.id);

  if (id === null) {
    return {
      type: 'error',
      message: `Usage: ${params.prefix}${params.alias} delete <id>`,
    };
  }

  if (!deleteTodo(params.db, id)) {
    return {
      type: 'error',
      message: `Todo not found: #${id}`,
    };
  }

  return {
    type: 'success',
    message: `Todo #${id} deleted (and all descendants).`,
  };
}

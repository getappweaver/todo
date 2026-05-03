import type { Database } from 'bun:sqlite';

import { startTodo } from './db';

function parseOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

export type StartCommandResult =
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'success';
      id: number;
      message: string;
    };

export function handleStartCommand(params: {
  prefix: string;
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
}): StartCommandResult {
  const id = parseOptionalInteger(params.arguments.id);

  if (id === null) {
    return {
      type: 'error',
      message: `Usage: ${params.prefix}${params.alias} start <id>`,
    };
  }

  if (!startTodo(params.db, id)) {
    return {
      type: 'error',
      message: `Todo not found: #${id}`,
    };
  }

  return {
    type: 'success',
    id,
    message: `Todo #${id} set to in progress.`,
  };
}

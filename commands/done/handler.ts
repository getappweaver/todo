import type { Database } from 'bun:sqlite';

import { doneTodo } from '../../db/todos';

function parseOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

export type DoneCommandResult =
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'success';
      id: number;
      message: string;
    };

export function handleDoneCommand(params: {
  prefix: string;
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
}): DoneCommandResult {
  const id = parseOptionalInteger(params.arguments.id);

  if (id === null) {
    return {
      type: 'error',
      message: `Usage: ${params.prefix}${params.alias} done <id>`,
    };
  }

  if (!doneTodo(params.db, id)) {
    return {
      type: 'error',
      message: `Todo not found: #${id}`,
    };
  }

  return {
    type: 'success',
    id,
    message: `Todo #${id} marked done (and all descendants).`,
  };
}

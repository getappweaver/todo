import type { Database } from 'bun:sqlite';

import { doneTodo, getTodo } from '../../db/todos';

const TODO_MUTATION_DEBUG = process.env.TODO_MUTATION_DEBUG === '1';

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

  const existing = getTodo(params.db, id);

  if (!existing) {
    return {
      type: 'error',
      message: `Todo not found: #${id}`,
    };
  }

  doneTodo(params.db, id);

  if (TODO_MUTATION_DEBUG) {
    console.log(
      `[todo:mutation] update: status ${existing.status} -> done`,
      JSON.stringify({ id, cascade: true }),
    );
  }

  return {
    type: 'success',
    id,
    message: `Todo #${id} marked done (and all descendants).`,
  };
}

import type { Database } from 'bun:sqlite';

import { getTodo } from '../../db/todos';

import { startTodo } from './db';

const TODO_MUTATION_DEBUG = process.env.TODO_MUTATION_DEBUG === '1';

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

  const existing = getTodo(params.db, id);

  if (!existing) {
    return {
      type: 'error',
      message: `Todo not found: #${id}`,
    };
  }

  startTodo(params.db, id);

  if (TODO_MUTATION_DEBUG) {
    console.log(
      `[todo:mutation] update: status ${existing.status} -> in_progress`,
      JSON.stringify({ id }),
    );
  }

  return {
    type: 'success',
    id,
    message: `Todo #${id} set to in progress.`,
  };
}

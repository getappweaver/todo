import type { Database } from 'bun:sqlite';

import { getTodo } from './db';

function parseOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

export type ShowCommandResult =
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'success';
      item: {
        id: number;
        text: string;
        status: 'pending' | 'in_progress' | 'done' | 'cancelled';
        parentId: number | null;
        tags: string[] | null;
        description: string | null;
        createdAt: number;
        updatedAt: number | null;
        completedAt: number | null;
      };
    };

export function handleShowCommand(params: {
  prefix: string;
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
}): ShowCommandResult {
  const id = parseOptionalInteger(params.arguments.id);

  if (id === null) {
    return {
      type: 'error',
      message: `Usage: ${params.prefix}${params.alias} show <id>`,
    };
  }

  const todo = getTodo(params.db, id);

  if (!todo) {
    return {
      type: 'error',
      message: `Todo not found: #${id}`,
    };
  }

  return {
    type: 'success',
    item: {
      id: todo.id,
      text: todo.todo,
      status: todo.status,
      parentId: todo.parent_id,
      tags: todo.tags,
      description: todo.description,
      createdAt: todo.created_at,
      updatedAt: todo.updated_at,
      completedAt: todo.completed_at,
    },
  };
}

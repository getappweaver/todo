import type { Database } from 'bun:sqlite';

import { createTodo, getTodo } from './db';

function parseOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function parseRequiredText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    const parts = value.filter(
      (item): item is string => typeof item === 'string',
    );

    const text = parts.join(' ').trim();

    return text || null;
  }

  return null;
}

export type AddCommandResult =
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'success';
      item: {
        id: number;
        parentId: number | null;
        text: string;
        status: 'pending' | 'in_progress' | 'done' | 'cancelled';
        description: string | null;
        tags: string[] | null;
        createdAt: number;
        updatedAt: number | null;
        completedAt: number | null;
      };
    };

export function handleAddCommand(params: {
  prefix: string;
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
  options: Record<string, unknown>;
}): AddCommandResult {
  const text = parseRequiredText(params.arguments.text);
  const parentId = parseOptionalInteger(params.options.under);

  if (!text) {
    return {
      type: 'error',
      message: `Usage: ${params.prefix}${params.alias} add <text...> [--under <under>]`,
    };
  }

  if (parentId !== null && !getTodo(params.db, parentId)) {
    return {
      type: 'error',
      message: `Parent todo not found: #${parentId}`,
    };
  }

  const todo = createTodo({
    db: params.db,
    text,
    parentId,
  });

  return {
    type: 'success',
    item: {
      id: todo.id,
      parentId: todo.parent_id,
      text: todo.todo,
      status: todo.status,
      description: todo.description,
      tags: todo.tags,
      createdAt: todo.created_at,
      updatedAt: todo.updated_at,
      completedAt: todo.completed_at,
    },
  };
}

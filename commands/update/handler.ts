import type { Database } from 'bun:sqlite';

import { TodoStatusSchema } from '../../types/todos';

import { getTodo, updateTodo } from './db';

function parseOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function parseRequiredString(value: unknown): string | null {
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

export type UpdateCommandResult =
  | { type: 'error'; message: string }
  | {
      type: 'success';
      message: string;
      item: NonNullable<ReturnType<typeof updateTodo>>;
    };

export function handleUpdateCommand(params: {
  prefix: string;
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
}): UpdateCommandResult {
  const id = parseOptionalInteger(params.arguments.id);

  const field =
    parseRequiredString(params.arguments.field)?.toLowerCase() ?? null;

  const value = parseRequiredString(params.arguments.value);

  if (id === null || !field || !value) {
    return {
      type: 'error',
      message: `Usage: ${params.prefix}${params.alias} update <id> <field> <value...>`,
    };
  }

  if (!getTodo(params.db, id)) {
    return {
      type: 'error',
      message: `Todo not found: #${id}`,
    };
  }

  switch (field) {
    case 'todo':
    case 'title': {
      const updated = updateTodo(params.db, { id, todo: value });

      return {
        type: 'success',
        message: 'Todo updated.',
        item: updated!,
      };
    }

    case 'status': {
      const statusParsed = TodoStatusSchema.safeParse(value);

      if (!statusParsed.success) {
        return {
          type: 'error',
          message: 'Status must be: pending, in_progress, done, or cancelled',
        };
      }

      const updated = updateTodo(params.db, { id, status: statusParsed.data });

      return {
        type: 'success',
        message: 'Status updated.',
        item: updated!,
      };
    }

    case 'description': {
      const updated = updateTodo(params.db, { id, description: value });

      return {
        type: 'success',
        message: 'Description updated.',
        item: updated!,
      };
    }

    default:
      return {
        type: 'error',
        message: `Unknown field: ${field}. Supported: todo, status, description`,
      };
  }
}

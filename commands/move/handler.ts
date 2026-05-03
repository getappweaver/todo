import type { Database } from 'bun:sqlite';

import { getTodo, moveTodo } from './db';

function parseOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

export type MoveCommandResult =
  | { type: 'error'; message: string }
  | {
      type: 'success';
      message: string;
      item?: NonNullable<ReturnType<typeof getTodo>>;
    };

export function handleMoveCommand(params: {
  prefix: string;
  alias: string;
  db: Database;
  arguments: Record<string, unknown>;
  options: Record<string, unknown>;
}): MoveCommandResult {
  const id = parseOptionalInteger(params.arguments.id);
  const newParentId = parseOptionalInteger(params.options.under);

  if (id === null) {
    return {
      type: 'error',
      message: `Usage: ${params.prefix}${params.alias} move <id> [--under <under>]`,
    };
  }

  if (newParentId !== null && newParentId === id) {
    return {
      type: 'error',
      message: `Cannot move #${id} under itself.`,
    };
  }

  const result = moveTodo(params.db, id, newParentId);

  if (!result.ok) {
    switch (result.reason) {
      case 'not_found':
        return { type: 'error', message: `Todo not found: #${id}` };
      case 'parent_not_found':
        return {
          type: 'error',
          message: `Parent todo not found: #${newParentId}`,
        };
      case 'self_parent':
        return { type: 'error', message: `Cannot move #${id} under itself.` };
      case 'cycle':
        return {
          type: 'error',
          message: `Cannot move #${id} under a descendant (would create a cycle).`,
        };
    }
  }

  if (result.unchanged) {
    const parentLabel =
      result.todo.parent_id === null
        ? 'top level'
        : `under #${result.todo.parent_id}`;

    return {
      type: 'success',
      message: `Todo #${id} is already at ${parentLabel}.`,
      item: result.todo,
    };
  }

  const where =
    result.todo.parent_id === null
      ? 'top level'
      : `under #${result.todo.parent_id} "${getTodo(params.db, result.todo.parent_id)?.todo ?? '?'}"`;

  return {
    type: 'success',
    message: `Moved #${id} to ${where}.`,
    item: result.todo,
  };
}

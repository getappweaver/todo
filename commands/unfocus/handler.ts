import type { Database } from 'bun:sqlite';

import { clearFocusId } from './db';

export type UnfocusCommandResult = {
  type: 'success';
  message: string;
};

export function handleUnfocusCommand(params: {
  db: Database;
}): UnfocusCommandResult {
  clearFocusId(params.db);

  return {
    type: 'success',
    message: 'Focus cleared.',
  };
}

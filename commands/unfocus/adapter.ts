import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleUnfocusCommand } from './handler';

export function adaptUnfocusCommand(params: TodoCommandAdapterParams): string {
  const result = handleUnfocusCommand({
    db: params.db,
  });

  return result.message;
}

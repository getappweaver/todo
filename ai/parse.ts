import type { ParseSettledResult } from '@src/tools/utils';
import { parseToolCalls } from '@src/tools/utils';

import { TodoToolCallSchema, type TodoToolCall } from './schema';

export function parseTodoToolCalls(
  raw: string,
): ParseSettledResult<TodoToolCall>[] {
  return parseToolCalls({ raw, schema: TodoToolCallSchema });
}

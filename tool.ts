import { z } from 'zod';

import type { ParseSettledResult } from '@src/tools/utils';
import { parseToolCalls } from '@src/tools/utils';

import { CreateTodoInputSchema, UpdateTodoInputSchema } from './types';

// ---------------------------------------------------------------------------
// TodoToolCall discriminated union + schema
// ---------------------------------------------------------------------------

const TodoListCallSchema = z.object({
  type: z.literal('list'),
});

const TodoCreateCallSchema = z.object({
  type: z.literal('create'),
  input: CreateTodoInputSchema,
});

const TodoUpdateCallSchema = z.object({
  type: z.literal('update'),
  input: UpdateTodoInputSchema,
});

const TodoDeleteCallSchema = z.object({
  type: z.literal('delete'),
  input: z.object({
    id: z.number().int().positive().describe('ID of the todo to delete'),
  }),
});

const TodoToolCallSchema = z.discriminatedUnion('type', [
  TodoListCallSchema,
  TodoCreateCallSchema,
  TodoUpdateCallSchema,
  TodoDeleteCallSchema,
]);

export type TodoToolCall = z.infer<typeof TodoToolCallSchema>;

export function buildSystemPrompt(userPrompt: string, activeTree: string): string {
  const schema = z.toJSONSchema(TodoToolCallSchema);

  return `You are managing a todo list for the user.

Active todos (pending and in progress):
${activeTree}

User request: "${userPrompt}"

Instructions:
- If the user wants to see todos, output type "list".
- If the user wants to create a new todo (e.g. "add ...", "create ..."), output type "create". Use the active todos above to resolve any parent todo name to its numeric id.
- If the user wants to update an existing todo (e.g. "update ...", "change ...", "set ... to ...", "mark ... as ...", or changing status/priority/text of something that already exists), output type "update". Resolve the todo by name from the active list to its numeric id and only include the fields being changed (id plus status, todo, priority, etc. as needed).
- If the user wants to delete a todo, output type "delete".
- Important: "update [todo name] status to X" or "change [todo name] to pending" means update the existing todo with that name — use "update" with that todo's id and the new status, not "create".
- For name resolution: match by name (case-insensitive, partial match is fine). If ambiguous, pick the closest match and note it in the todo text.

Output one or more JSON objects matching this JSON Schema. Use a single object for one operation, or one JSON object per line (JSONL) for multiple operations (e.g. creating several todos). No markdown, no code fence, no explanation:

${JSON.stringify(schema, null, 2)}`;
}

export function parseTodoToolCalls(raw: string): ParseSettledResult<TodoToolCall>[] {
  return parseToolCalls({ raw, schema: TodoToolCallSchema });
}

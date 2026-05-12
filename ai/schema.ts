import { z } from 'zod';

import { CreateTodoDraftSchema } from '../types/drafts';
import { TodoStatusSchema, UpdateTodoInputSchema } from '../types/todos';

export const TodoListCallSchema = z.object({
  type: z.literal('list'),
  id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'When the prompt mentions a todo like #154 and you need context, set id to fetch that todo and its visible subtree before acting.',
    ),
  filter: z
    .array(TodoStatusSchema)
    .min(1)
    .optional()
    .describe(
      'Omit for active todos (pending + in_progress; excludes done and cancelled), same as `!todo list` with no filter. If set, include only rows whose status is in this array - combine any statuses (e.g. ["in_progress"] only, or all four for everything).',
    ),
  desc: z
    .boolean()
    .optional()
    .describe('When true, include todo descriptions in the formatted list.'),
});

export const TodoCreateCallSchema = z.object({
  type: z.literal('create'),
  input: CreateTodoDraftSchema,
  original_prompt: z.string(),
});

export const TodoUpdateCallSchema = z.object({
  type: z.literal('update'),
  input: UpdateTodoInputSchema,
  original_prompt: z.string(),
});

export const TodoDeleteCallSchema = z.object({
  type: z.literal('delete'),
  input: z.object({
    id: z.number().int().positive().describe('ID of the todo to delete'),
  }),
  original_prompt: z.string(),
});

export const TodoToolCallSchema = z.discriminatedUnion('type', [
  TodoListCallSchema,
  TodoCreateCallSchema,
  TodoUpdateCallSchema,
  TodoDeleteCallSchema,
]);

export type TodoToolCall = z.infer<typeof TodoToolCallSchema>;

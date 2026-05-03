import { z } from 'zod';

export const TodoStatusSchema = z.enum([
  'pending',
  'in_progress',
  'done',
  'cancelled',
]);

export type TodoStatus = z.infer<typeof TodoStatusSchema>;

export const TodoSchema = z.object({
  id: z.number(),
  parent_id: z.number().nullable(),
  todo: z.string(),
  status: TodoStatusSchema,
  sort_order: z.number().nullable(),
  description: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  source: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number().nullable(),
  completed_at: z.number().nullable(),
});

export type Todo = z.infer<typeof TodoSchema>;

export type TodoWithWinStats = Todo & {
  wins: number;
  losses: number;
  win_rate: number | null;
};

export const CreateTodoInputSchema = z.object({
  todo: z
    .string()
    .min(1)
    .describe('Short title or one-line description of the todo'),
  parent_id: z
    .number()
    .nullable()
    .describe(
      'ID of the parent todo. NULL for top-level. Call list_todos first to resolve a name to an ID.',
    ),
  description: z.string().nullable().describe('Optional longer notes'),
  tags: z
    .array(z.string())
    .nullable()
    .describe('Optional tags e.g. ["work", "personal"]'),
});

export type CreateTodoInput = z.infer<typeof CreateTodoInputSchema>;

export const UpdateTodoInputSchema = z.object({
  id: z.number(),
  todo: z.string().min(1).optional(),
  status: TodoStatusSchema.optional(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

export type UpdateTodoInput = z.infer<typeof UpdateTodoInputSchema>;

// ---------------------------------------------------------------------------
// plugins/todo/types.ts — Types and Zod schemas for the todos feature
// ---------------------------------------------------------------------------
import { z } from 'zod';

// Schemas (source of truth for validation and inferred types)
export const TodoStatusSchema = z.enum([
  'pending',
  'in_progress',
  'done',
  'cancelled',
]);
export const TodoPrioritySchema = z.enum(['low', 'medium', 'high']);

export type TodoStatus = z.infer<typeof TodoStatusSchema>;
export type TodoPriority = z.infer<typeof TodoPrioritySchema>;

export const TodoSchema = z.object({
  id: z.number(),
  parent_id: z.number().nullable(),
  todo: z.string(),
  status: TodoStatusSchema,
  priority: TodoPrioritySchema.nullable(),
  sort_order: z.number().nullable(),
  description: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  source: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number().nullable(),
  completed_at: z.number().nullable(),
});

export type Todo = z.infer<typeof TodoSchema>;

/** Any change in this schema MUST be reflected in the tool in .opencode/tool/todo.ts */
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
  priority: TodoPrioritySchema.nullable().describe(
    'Optional priority: low, medium, or high',
  ),
  description: z.string().nullable().describe('Optional longer notes'),
  tags: z
    .array(z.string())
    .nullable()
    .describe('Optional tags e.g. ["work", "personal"]'),
});

export type CreateTodoInput = z.infer<typeof CreateTodoInputSchema>;

export interface CreateTodoDraft {
  todo: string;
  parent_id: number | null;
  priority: z.infer<typeof TodoPrioritySchema> | null;
  description: string | null;
  tags: string[] | null;
  children?: CreateTodoDraft[];
}

export const CreateTodoDraftSchema: z.ZodType<CreateTodoDraft> = z.lazy(() =>
  z.object({
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
    priority: TodoPrioritySchema.nullable().describe(
      'Optional priority: low, medium, or high',
    ),
    description: z.string().nullable().describe('Optional longer notes'),
    tags: z
      .array(z.string())
      .nullable()
      .describe('Optional tags e.g. ["work", "personal"]'),
    children: z
      .array(CreateTodoDraftSchema)
      .optional()
      .describe('Optional children todos'),
  }),
);

/** Any change in this schema MUST be reflected in the tool in .opencode/tool/todo.ts */
export const UpdateTodoInputSchema = z.object({
  id: z.number().describe('ID of the todo to update'),
  todo: z.string().min(1).optional().describe('New title'),
  status: TodoStatusSchema.optional().describe('New status'),
  priority: TodoPrioritySchema.nullable().optional().describe('New priority'),
  description: z.string().nullable().optional().describe('New description'),
  tags: z.array(z.string()).nullable().optional().describe('New tags'),
});

export type UpdateTodoInput = z.infer<typeof UpdateTodoInputSchema>;

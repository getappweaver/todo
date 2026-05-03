import { z } from 'zod';

import { createRepresentationSchema } from '@src/system/representation';

export const ListStatusSchema = z.enum([
  'pending',
  'in_progress',
  'done',
  'cancelled',
]);

export const ListItemSchema = z.object({
  id: z.number().int().positive(),
  parentId: z.number().int().positive().nullable(),
  text: z.string().min(1),
  status: ListStatusSchema,
  description: z.string().nullable(),
  depth: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  winRate: z.number().nullable(),
});

export const ListScopeSchema = z.object({
  rootId: z.number().int().positive(),
  rootTitle: z.string().min(1),
});

export const ListDataSchema = z.object({
  scope: ListScopeSchema.nullable(),
  view: z.enum(['tree', 'flat']),
  showDescriptions: z.boolean().optional().default(false),
  /** Echo of list invocation so web actions can re-run the same `list` after mutations. */
  listInvocation: z.object({
    arguments: z.record(z.string(), z.unknown()),
    options: z.record(z.string(), z.unknown()),
  }),
  items: z.array(ListItemSchema),
});

export const ListRepresentationSchema = createRepresentationSchema(
  ListDataSchema,
).extend({
  kind: z.literal('list'),
});

export type ListItem = z.infer<typeof ListItemSchema>;
export type ListScope = z.infer<typeof ListScopeSchema>;
export type ListRepresentation = z.infer<typeof ListRepresentationSchema>;

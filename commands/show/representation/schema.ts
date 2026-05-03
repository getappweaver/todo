import { z } from 'zod';

import { createRepresentationSchema } from '@src/system/representation';

export const ShowStatusSchema = z.enum([
  'pending',
  'in_progress',
  'done',
  'cancelled',
]);

export const ShowItemSchema = z.object({
  id: z.number().int().positive(),
  text: z.string().min(1),
  status: ShowStatusSchema,
  parentId: z.number().int().positive().nullable(),
  tags: z.array(z.string()).nullable(),
  description: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative().nullable(),
  completedAt: z.number().int().nonnegative().nullable(),
});

export const ShowDataSchema = z.object({
  item: ShowItemSchema,
});

export const ShowRepresentationSchema = createRepresentationSchema(
  ShowDataSchema,
).extend({
  kind: z.literal('show'),
});

export type ShowRepresentation = z.infer<typeof ShowRepresentationSchema>;

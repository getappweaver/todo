import { z } from 'zod';

import type { UpdateTodoInput } from './todos';

export interface CreateTodoDraft {
  todo: string;
  parent_id: number | null;
  description: string | null;
  tags: string[] | null;
  children?: CreateTodoDraft[];
}

export const CreateTodoDraftSchema: z.ZodType<CreateTodoDraft> = z.lazy(() =>
  z.object({
    todo: z.string().min(1),
    parent_id: z.number().nullable(),
    description: z.string().nullable(),
    tags: z.array(z.string()).nullable(),
    children: z.array(CreateTodoDraftSchema).optional(),
  }),
);

export type CreateDraftEntry = {
  kind: 'create';
  input: CreateTodoDraft;
  originalPrompt: string;
};

export type UpdateDraftEntry = {
  kind: 'update';
  input: UpdateTodoInput;
  originalPrompt: string;
};

export type DeleteDraftEntry = {
  kind: 'delete';
  input: { id: number };
  originalPrompt: string;
};

export type TodoDraftEntry =
  | CreateDraftEntry
  | UpdateDraftEntry
  | DeleteDraftEntry;

export type TodoDraftRow = TodoDraftEntry & {
  id: number;
  sessionId: string;
  createdAt: number;
};

export type StoreDraftEntry = TodoDraftEntry & {
  sessionId: string;
};

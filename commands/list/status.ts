import { z } from 'zod';

export const LIST_STATUS_FILTER_CHOICES = [
  'done',
  'in_progress',
  'pending',
  'all',
] as const;

export const ListStatusFilterSchema = z.enum(LIST_STATUS_FILTER_CHOICES);

export type ListStatusFilter = z.infer<typeof ListStatusFilterSchema>;

export function formatListStatusFilterChoices(): string {
  return LIST_STATUS_FILTER_CHOICES.join('|');
}

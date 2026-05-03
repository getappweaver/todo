import type { TextRenderContext } from '@src/system/render-context';

import type { ShowRepresentation } from '../representation/schema';

function formatDate(value: number | null): string {
  return value === null ? '—' : new Date(value).toLocaleString();
}

export function renderShowText(
  representation: ShowRepresentation,
  _context: TextRenderContext,
): string {
  const item = representation.data.item;

  return [
    `ID:          ${item.id}`,
    `Todo:        ${item.text}`,
    `Status:      ${item.status}`,
    `Parent:      ${item.parentId ?? '(top-level)'}`,
    `Tags:        ${item.tags?.join(', ') ?? '—'}`,
    `Description: ${item.description ?? '—'}`,
    `Created:     ${formatDate(item.createdAt)}`,
    `Updated:     ${formatDate(item.updatedAt)}`,
    `Completed:   ${formatDate(item.completedAt)}`,
  ].join('\n');
}

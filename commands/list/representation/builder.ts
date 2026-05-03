import type { z } from 'zod';

import type { ListItemSchema, ListRepresentation } from './schema';

export function createListRepresentation(params: {
  command: string;
  subcommand: string;
  scope: { rootId: number; rootTitle: string } | null;
  view: 'tree' | 'flat';
  showDescriptions: boolean;
  listInvocation: {
    arguments: Record<string, unknown>;
    options: Record<string, unknown>;
  };
  items: z.input<typeof ListItemSchema>[];
}): ListRepresentation {
  return {
    kind: 'list',
    version: 1,
    meta: {
      command: params.command,
      subcommand: params.subcommand,
    },
    data: {
      scope: params.scope,
      view: params.view,
      showDescriptions: params.showDescriptions,
      listInvocation: params.listInvocation,
      items: params.items,
    },
  };
}

import type { z } from 'zod';

import type { ShowItemSchema, ShowRepresentation } from './schema';

export function createShowRepresentation(params: {
  command: string;
  subcommand: string;
  item: z.input<typeof ShowItemSchema>;
}): ShowRepresentation {
  return {
    kind: 'show',
    version: 1,
    meta: {
      command: params.command,
      subcommand: params.subcommand,
    },
    data: {
      item: params.item,
    },
  };
}

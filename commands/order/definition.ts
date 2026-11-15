import type { SubcommandDefinition } from '@src/system/command-definition';

import {
  formatListStatusFilterChoices,
  LIST_STATUS_FILTER_CHOICES,
} from '../list/status';

export const orderDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'order',
  summary: 'Reorder active root todos.',
  aliases: [],
  arguments: [],
  options: [
    {
      name: 'revision',
      summary: 'Reviewed root-order revision.',
      flag: '--revision',
      kind: 'string',
      required: true,
    },
    {
      name: 'items',
      summary: 'Active root todo IDs in desired order (repeat).',
      flag: '--items',
      kind: 'string',
      required: true,
      multiple: true,
    },
    {
      name: 'status',
      summary: `Filter by status: ${formatListStatusFilterChoices()}.`,
      flag: '--status',
      kind: 'string',
      multiple: true,
      choices: [...LIST_STATUS_FILTER_CHOICES],
    },
    {
      name: 'champion',
      summary: 'Show only branch champions and the priority winner.',
      flag: '--champion',
      kind: 'boolean',
    },
    {
      name: 'desc',
      summary: 'Include descriptions.',
      flag: '--desc',
      kind: 'boolean',
    },
    {
      name: 'level',
      summary: 'Limit output to a tree depth.',
      flag: '--level',
      kind: 'integer',
    },
  ],
  examples: [
    `${prefix}${alias} order --revision <rev> --items 3 --items 1 --items 2`,
  ],
});

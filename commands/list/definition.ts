import type { SubcommandDefinition } from '@src/system/command-definition';

import {
  formatListStatusFilterChoices,
  LIST_STATUS_FILTER_CHOICES,
} from './status';

export const listDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'list',
  summary: 'List todos in the current scope or a selected subtree.',
  aliases: [],
  arguments: [
    {
      name: 'rootId',
      summary: 'Optional subtree root todo ID.',
      kind: 'integer',
    },
  ],
  options: [
    {
      name: 'status',
      summary: `Filter by status: ${formatListStatusFilterChoices()}.`,
      flag: '--status',
      kind: 'string',
      multiple: true,
      choices: [...LIST_STATUS_FILTER_CHOICES],
    },
    {
      name: 'flat',
      summary: 'Render a flat list.',
      flag: '--flat',
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
    `${prefix}${alias} list`,
    `${prefix}${alias} list --status in_progress`,
    `${prefix}${alias} list --status pending --status done`,
    `${prefix}${alias} list 12 --status done --flat`,
  ],
  webWidget: {
    placement: 'header',
    surface: 'timeline_singleton',
    label: 'Todo',
    modalTitle: 'Todo list',
    icon: '/plugins/todo/commands/list/renderers/list.svg',
    order: 20,
  },
});

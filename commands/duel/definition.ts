import type { SubcommandDefinition } from '@src/system/command-definition';

export const duelDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'duel',
  summary: 'Rank sibling todos by pairwise comparison.',
  aliases: [],
  arguments: [
    {
      name: 'parentId',
      summary: 'Optional scope root todo ID.',
      kind: 'integer',
    },
  ],
  options: [
    {
      name: 'reset',
      summary: 'Reset comparisons before starting the duel.',
      flag: '--reset',
      kind: 'boolean',
    },
  ],
  examples: [
    `${prefix}${alias} duel`,
    `${prefix}${alias} duel 12`,
    `${prefix}${alias} duel --reset`,
  ],
});

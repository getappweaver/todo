import type { SubcommandDefinition } from '@src/system/command-definition';

export const duelDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'pick',
  summary: 'Pick a branch winner or run a comparison.',
  aliases: [],
  arguments: [
    {
      name: 'parentId',
      summary: 'Optional scope root todo ID.',
      kind: 'integer',
    },
    {
      name: 'duelArgs',
      summary: 'Internal web pick action tokens.',
      kind: 'string',
      variadic: true,
    },
  ],
  options: [
    {
      name: 'reset',
      summary: 'Reset comparisons before starting.',
      flag: '--reset',
      kind: 'boolean',
    },
  ],
  examples: [
    `${prefix}${alias} pick`,
    `${prefix}${alias} pick 12`,
    `${prefix}${alias} pick --reset`,
  ],
});

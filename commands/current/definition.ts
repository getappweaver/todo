import type { SubcommandDefinition } from '@src/system/command-definition';

export const currentDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'current',
  summary: 'Show the current leaf todo in the selected scope.',
  aliases: [],
  arguments: [
    {
      name: 'parentId',
      summary: 'Optional scope root todo ID.',
      kind: 'integer',
    },
  ],
  options: [],
  examples: [`${prefix}${alias} current`, `${prefix}${alias} current 12`],
});

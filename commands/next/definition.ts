import type { SubcommandDefinition } from '@src/system/command-definition';

export const nextDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'next',
  summary: 'Show the next pending leaf after the current one in scope.',
  aliases: [],
  arguments: [
    {
      name: 'parentId',
      summary: 'Optional scope root todo ID.',
      kind: 'integer',
    },
  ],
  options: [],
  examples: [`${prefix}${alias} next`, `${prefix}${alias} next 12`],
});

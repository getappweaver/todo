import type { SubcommandDefinition } from '@src/system/command-definition';

export const draftsDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'drafts',
  summary: 'List pending drafts or show a single draft.',
  aliases: [],
  arguments: [
    {
      name: 'id',
      summary: 'Optional draft ID to inspect.',
      kind: 'integer',
    },
  ],
  options: [],
  examples: [`${prefix}${alias} drafts`, `${prefix}${alias} drafts 7`],
});

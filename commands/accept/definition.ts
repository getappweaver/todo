import type { SubcommandDefinition } from '@src/system/command-definition';

export const acceptDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'accept',
  summary: 'Accept one draft or all drafts.',
  aliases: [],
  arguments: [
    {
      name: 'target',
      summary: 'Draft ID or the word all.',
      kind: 'string',
      required: true,
    },
  ],
  options: [],
  examples: [`${prefix}${alias} accept 7`, `${prefix}${alias} accept all`],
});

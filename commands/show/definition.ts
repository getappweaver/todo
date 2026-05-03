import type { SubcommandDefinition } from '@src/system/command-definition';

export const showDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'show',
  summary: 'Show detail for a single todo.',
  aliases: [],
  arguments: [
    {
      name: 'id',
      summary: 'Todo ID to show.',
      kind: 'integer',
      required: true,
    },
  ],
  options: [],
  examples: [`${prefix}${alias} show 42`],
});

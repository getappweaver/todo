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
  options: [
    {
      name: 'listContext',
      summary: 'List invocation to refresh after editing from the web widget.',
      flag: '--list-context',
      kind: 'string',
      required: false,
      shortFlag: null,
    },
  ],
  examples: [`${prefix}${alias} show 42`],
});

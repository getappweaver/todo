import type { SubcommandDefinition } from '@src/system/command-definition';

export const helpDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'help',
  summary: 'Show help for todo',
  aliases: ['h'],
  arguments: [
    {
      name: 'topic',
      summary: 'Topic to show help for',
      kind: 'string',
      required: true,
    },
  ],
  options: [],
  examples: [`${prefix}${alias} help bot`, `${prefix}${alias} help bot lint`],
});

import type { SubcommandDefinition } from '@src/system/command-definition';

export const addDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'add',
  summary: 'Add a todo, optionally under a parent todo.',
  aliases: [],
  arguments: [
    {
      name: 'text',
      summary: 'Todo text to create.',
      kind: 'string',
      required: true,
      variadic: true,
    },
  ],
  options: [
    {
      name: 'under',
      summary: 'Optional parent todo ID.',
      flag: '--under',
      kind: 'integer',
    },
  ],
  examples: [
    `${prefix}${alias} add buy oat milk`,
    `${prefix}${alias} add draft release notes --under 12`,
  ],
});

import type { SubcommandDefinition } from '@src/system/command-definition';

export const startDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'start',
  summary: 'Set a todo to in progress.',
  aliases: [],
  arguments: [
    {
      name: 'id',
      summary: 'Todo ID to start.',
      kind: 'integer',
      required: true,
    },
  ],
  options: [],
  examples: [`${prefix}${alias} start 42`],
});

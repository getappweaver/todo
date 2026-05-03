import type { SubcommandDefinition } from '@src/system/command-definition';

export const focusDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'focus',
  summary: 'Set the current focus todo.',
  aliases: [],
  arguments: [
    {
      name: 'id',
      summary: 'Todo ID to focus.',
      kind: 'integer',
      required: true,
    },
  ],
  options: [],
  examples: [`${prefix}${alias} focus 42`],
});

import type { SubcommandDefinition } from '@src/system/command-definition';

export const moveDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'move',
  summary: 'Move a todo under a new parent or back to the top level.',
  aliases: [],
  arguments: [
    {
      name: 'id',
      summary: 'Todo ID to move.',
      kind: 'integer',
      required: true,
    },
  ],
  options: [
    {
      name: 'under',
      summary: 'Optional parent todo ID. Omit for top level.',
      flag: '--under',
      kind: 'integer',
    },
  ],
  examples: [
    `${prefix}${alias} move 42`,
    `${prefix}${alias} move 42 --under 7`,
  ],
});

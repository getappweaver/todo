import type { SubcommandDefinition } from '@src/system/command-definition';

export const doneDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'done',
  summary: 'Mark a todo and its descendants as done.',
  aliases: [],
  arguments: [
    {
      name: 'id',
      summary: 'Todo ID to mark done.',
      kind: 'integer',
      required: true,
    },
  ],
  options: [],
  examples: [`${prefix}${alias} done 42`],
});

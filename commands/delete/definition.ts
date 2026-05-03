import type { SubcommandDefinition } from '@src/system/command-definition';

export const deleteDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'delete',
  summary: 'Delete a todo and all of its descendants.',
  aliases: [],
  arguments: [
    {
      name: 'id',
      summary: 'Todo ID to delete.',
      kind: 'integer',
      required: true,
    },
  ],
  options: [],
  examples: [`${prefix}${alias} delete 42`],
});

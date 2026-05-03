import type { SubcommandDefinition } from '@src/system/command-definition';

export const declineDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'decline',
  summary: 'Discard a pending draft.',
  aliases: [],
  arguments: [
    {
      name: 'id',
      summary: 'Draft ID to discard.',
      kind: 'integer',
      required: true,
    },
  ],
  options: [],
  examples: [`${prefix}${alias} decline 7`],
});

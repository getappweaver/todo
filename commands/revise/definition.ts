import type { SubcommandDefinition } from '@src/system/command-definition';

export const reviseDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'revise',
  summary: 'Revise a create draft with AI-generated corrections.',
  aliases: [],
  arguments: [
    {
      name: 'id',
      summary: 'Draft ID to revise.',
      kind: 'integer',
      required: true,
    },
    {
      name: 'corrections',
      summary: 'Correction text for the revised draft.',
      kind: 'string',
      required: true,
      variadic: true,
    },
  ],
  options: [],
  examples: [`${prefix}${alias} revise 7 split this into subtasks`],
});

import type { SubcommandDefinition } from '@src/system/command-definition';

export const aiDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'ai',
  summary: 'Use AI to list todos or prepare draft todo changes.',
  aliases: [],
  arguments: [
    {
      name: 'prompt',
      summary: 'Natural-language instruction for todo operations.',
      kind: 'string',
      required: true,
      variadic: true,
    },
  ],
  options: [],
  examples: [
    `${prefix}${alias} ai show my todos`,
    `${prefix}${alias} ai add a todo to take medicine tonight at 9PM`,
  ],
});

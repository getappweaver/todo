import type { SubcommandDefinition } from '@src/system/command-definition';

export const unfocusDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'unfocus',
  summary: 'Clear the current focus todo.',
  aliases: [],
  arguments: [],
  options: [],
  examples: [`${prefix}${alias} unfocus`],
});

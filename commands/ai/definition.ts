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
  options: [
    {
      name: 'save_selections',
      flag: '--save-selections',
      summary: 'Persist the supplied Todo AI inclusion selections.',
      kind: 'boolean',
      required: false,
    },
    {
      name: 'include_user_instructions',
      flag: '--include-user-instructions',
      summary: 'Include saved Todo User Instructions.',
      kind: 'boolean',
      required: false,
    },
    {
      name: 'runtime_context',
      flag: '--runtime-context',
      summary: 'Include AppWeaver runtime context.',
      kind: 'boolean',
      required: false,
    },
    {
      name: 'workspace_instructions',
      flag: '--workspace-instructions',
      summary: 'Include configured workspace instructions.',
      kind: 'boolean',
      required: false,
    },
    {
      name: 'agents_instructions',
      flag: '--agents-instructions',
      summary: 'Include AGENTS.md instructions.',
      kind: 'boolean',
      required: false,
    },
  ],
  examples: [
    `${prefix}${alias} ai show my todos`,
    `${prefix}${alias} ai add a todo to take medicine tonight at 9PM`,
  ],
});

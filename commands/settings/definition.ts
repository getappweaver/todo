import type { SubcommandDefinition } from '@src/system/command-definition';

export const settingsDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'settings',
  summary: 'Show or update Todo AI configuration.',
  aliases: ['config'],
  arguments: [],
  options: [
    {
      name: 'backend',
      flag: '--backend',
      summary: 'Backend override for Todo AI.',
      kind: 'string',
      required: false,
      choices: ['cursor', 'opencode'],
    },
    {
      name: 'model',
      flag: '--model',
      summary: 'Model override for Todo AI.',
      kind: 'string',
      required: false,
    },
    {
      name: 'user_instructions',
      flag: '--user-instructions',
      summary: 'Persistent Todo user instructions.',
      kind: 'string',
      required: false,
      webInput: 'textarea',
    },
    {
      name: 'reset',
      flag: '--reset',
      summary: 'Reset Todo AI configuration.',
      kind: 'boolean',
      required: false,
    },
  ],
  examples: [
    `${prefix}${alias} settings`,
    `${prefix}${alias} settings --backend opencode --model openai/gpt-5`,
    `${prefix}${alias} settings --reset`,
  ],
});

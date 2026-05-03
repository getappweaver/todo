import type { SubcommandDefinition } from '@src/system/command-definition';

export const updateDefinition = (
  prefix: string,
  alias: string,
): SubcommandDefinition => ({
  name: 'update',
  summary: 'Update a todo field such as title, status, or description.',
  aliases: [],
  arguments: [
    {
      name: 'id',
      summary: 'Todo ID to update.',
      kind: 'integer',
      required: true,
    },
    {
      name: 'field',
      summary: 'Field name: todo, title, status, or description.',
      kind: 'string',
      required: true,
    },
    {
      name: 'value',
      summary: 'New value for the selected field.',
      kind: 'string',
      required: true,
      variadic: true,
    },
  ],
  options: [],
  examples: [
    `${prefix}${alias} update 42 todo buy oat milk`,
    `${prefix}${alias} update 42 status in_progress`,
    `${prefix}${alias} update 42 description blocked on review`,
  ],
});

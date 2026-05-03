import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleShowCommand } from './handler';
import { renderShowText } from './renderers/text';
import { createShowRepresentation } from './representation/builder';

export function adaptShowCommand(params: TodoCommandAdapterParams): string {
  const result = handleShowCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
  });

  if (result.type === 'error') {
    return result.message;
  }

  const representation = createShowRepresentation({
    command: params.alias,
    subcommand: 'show',
    item: result.item,
  });

  return renderShowText(representation, { prefix: params.prefix });
}

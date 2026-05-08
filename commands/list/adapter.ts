import type { WebNodeRoot } from '@src/web/ui-schema';

import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { handleListCommand } from './handler';
import { renderListText } from './renderers/text';
import { renderListWeb } from './renderers/web';
import { createListRepresentation } from './representation/builder';

export function adaptListCommand(
  params: TodoCommandAdapterParams,
): string | WebNodeRoot {
  const result = handleListCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
    options: params.parsed.options,
  });

  if (result.type === 'error') {
    return result.message;
  }

  if (result.type === 'empty') {
    if (params.source === 'web') {
      return renderListWeb(
        createListRepresentation({
          command: params.alias,
          subcommand: 'list',
          scope: result.scope,
          view: result.view,
          showDescriptions: result.showDescriptions,
          listInvocation: {
            arguments: { ...params.parsed.arguments },
            options: { ...params.parsed.options },
          },
          items: [],
        }),
        { prefix: params.prefix },
      );
    }

    return result.message;
  }

  const representation = createListRepresentation({
    command: params.alias,
    subcommand: 'list',
    scope: result.scope,
    view: result.view,
    showDescriptions: result.showDescriptions,
    listInvocation: {
      arguments: { ...params.parsed.arguments },
      options: { ...params.parsed.options },
    },
    items: result.items,
  });

  if (params.source === 'web') {
    return renderListWeb(representation, { prefix: params.prefix });
  }

  return renderListText(representation, { prefix: params.prefix });
}

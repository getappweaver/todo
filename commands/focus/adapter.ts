import type { WebNodeRoot } from '@src/web/ui-schema';

import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { buildFocusedScopeWebNode } from '../list/renderers/web';

import { handleFocusCommand } from './handler';

export function adaptFocusCommand(
  params: TodoCommandAdapterParams,
): string | WebNodeRoot {
  const result = handleFocusCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
  });

  if (result.type === 'error') {
    return result.message;
  }

  if (params.source === 'web') {
    return {
      kind: 'ui',
      version: 1,
      meta: {
        command: params.alias,
        subcommand: 'focus',
      },
      tree: buildFocusedScopeWebNode({
        commandAlias: params.alias,
        // No listInvocation here — cannot re-fetch list in place after unfocus.
        refresh: null,
      }),
    };
  }

  return result.message;
}

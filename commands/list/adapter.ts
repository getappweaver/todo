import type { WebNodeRoot } from '@src/web/ui-schema';

import { getTodoAiSettings } from '../../settings';
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
      const aiSettings = getTodoAiSettings(params.db);

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
          priorityPrompt: null,
          items: [],
        }),
        {
          prefix: params.prefix,
          aiSettings,
          agentDefaults: params.agent.getDefaults(),
          effectiveModel: params.agent.getEffectiveModel({
            backend: aiSettings.backend,
            model: aiSettings.model,
            mode: null,
            workspaceTarget: null,
          }),
        },
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
    priorityPrompt: result.priorityPrompt,
    items: result.items,
  });

  if (params.source === 'web') {
    const aiSettings = getTodoAiSettings(params.db);

    return renderListWeb(representation, {
      prefix: params.prefix,
      aiSettings,
      agentDefaults: params.agent.getDefaults(),
      effectiveModel: params.agent.getEffectiveModel({
        backend: aiSettings.backend,
        model: aiSettings.model,
        mode: null,
        workspaceTarget: null,
      }),
    });
  }

  return renderListText(representation, { prefix: params.prefix });
}

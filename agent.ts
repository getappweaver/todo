import type { Database } from 'bun:sqlite';

import type {
  PluginAgentRunResult,
  PluginAgentService,
} from '@src/core/plugin';

import { getTodoAiSettings } from './settings';

export async function runTodoAgent(props: {
  agent: PluginAgentService;
  prompt: string;
  db: Database;
}): Promise<PluginAgentRunResult> {
  const settings = getTodoAiSettings(props.db);

  const hasContext =
    settings.runtimeContext ||
    settings.workspaceInstructions ||
    settings.agentsInstructions ||
    (settings.includeUserInstructions && settings.userInstructions.length > 0);

  return props.agent.run({
    prompt: props.prompt,
    sessionId: null,
    backend: settings.backend,
    provider: null,
    model: settings.model,
    mode: null,
    workspaceTarget: null,
    cwd: null,
    onAgentStreamChunk: null,
    abortSignal: null,
    context: hasContext
      ? {
          runtimeContext: settings.runtimeContext,
          workspaceInstructions: settings.workspaceInstructions,
          agentsInstructions: settings.agentsInstructions,
          extraInstructions:
            settings.includeUserInstructions && settings.userInstructions
              ? settings.userInstructions
              : null,
        }
      : null,
  });
}

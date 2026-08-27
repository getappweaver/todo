import type { Database } from 'bun:sqlite';

import type { AgentBackendName } from '@src/db';

export type TodoAiSettings = {
  backend: AgentBackendName | null;
  model: string | null;
  runtimeContext: boolean;
  workspaceInstructions: boolean;
  agentsInstructions: boolean;
  userInstructions: string;
  includeUserInstructions: boolean;
};

const KEYS = {
  backend: 'ai_backend',
  model: 'ai_model',
  runtimeContext: 'ai_runtime_context',
  workspaceInstructions: 'ai_workspace_instructions',
  agentsInstructions: 'ai_agents_instructions',
  userInstructions: 'ai_user_instructions',
  includeUserInstructions: 'ai_include_user_instructions',
} as const;

function get(db: Database, key: string): string | null {
  const row = db
    .prepare('SELECT value FROM todo_settings WHERE key = ?')
    .get(key) as { value: string | null } | undefined;

  return row?.value ?? null;
}

function set(db: Database, key: string, value: string | null): void {
  if (value === null) {
    db.run('DELETE FROM todo_settings WHERE key = ?', [key]);

    return;
  }

  db.run(
    `INSERT INTO todo_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

function backend(value: string | null): AgentBackendName | null {
  return value === 'cursor' || value === 'opencode' ? value : null;
}

export function getTodoAiSettings(db: Database): TodoAiSettings {
  return {
    backend: backend(get(db, KEYS.backend)),
    model: get(db, KEYS.model),
    runtimeContext: get(db, KEYS.runtimeContext) === 'true',
    workspaceInstructions: get(db, KEYS.workspaceInstructions) === 'true',
    agentsInstructions: get(db, KEYS.agentsInstructions) === 'true',
    userInstructions: get(db, KEYS.userInstructions) ?? '',
    includeUserInstructions: get(db, KEYS.includeUserInstructions) !== 'false',
  };
}

export function saveTodoAiSettings(
  db: Database,
  settings: TodoAiSettings,
): TodoAiSettings {
  set(db, KEYS.backend, settings.backend);
  set(db, KEYS.model, settings.model);
  set(db, KEYS.runtimeContext, String(settings.runtimeContext));

  set(db, KEYS.workspaceInstructions, String(settings.workspaceInstructions));

  set(db, KEYS.agentsInstructions, String(settings.agentsInstructions));
  set(db, KEYS.userInstructions, settings.userInstructions.trim() || null);

  set(
    db,
    KEYS.includeUserInstructions,
    String(settings.includeUserInstructions),
  );

  return getTodoAiSettings(db);
}

export function resetTodoAiSettings(db: Database): TodoAiSettings {
  for (const key of Object.values(KEYS)) {
    set(db, key, null);
  }

  return getTodoAiSettings(db);
}

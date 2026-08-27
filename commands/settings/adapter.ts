import type { AgentBackendName } from '@src/db';
import type { WebNode, WebNodeRoot } from '@src/web/ui-schema';

import {
  getTodoAiSettings,
  resetTodoAiSettings,
  saveTodoAiSettings,
  type TodoAiSettings,
} from '../../settings';
import type { TodoCommandAdapterParams } from '../../types/adapter-params';

function text(value: string): WebNode {
  return { type: 'text', value };
}

function element(
  tag: Extract<WebNode, { type: 'element' }>['tag'],
  props: Record<string, unknown>,
  children: WebNode[],
): WebNode {
  return { type: 'element', tag, props, children } as WebNode;
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return typeof value === 'string' ? value.trim() || null : undefined;
}

function parseBackend(value: unknown): AgentBackendName | null | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value === '' || value === 'default') {
    return null;
  }

  if (value === 'cursor' || value === 'opencode') {
    return value;
  }

  throw new Error('Backend must be cursor or opencode.');
}

function formatSettings(settings: TodoAiSettings): string {
  return [
    'Todo AI settings:',
    `Backend: ${settings.backend ?? '(default)'}`,
    `Model: ${settings.model ?? '(default)'}`,
    `Todo User Instructions: ${settings.userInstructions || '(empty)'}`,
  ].join('\n');
}

function renderSettings(props: {
  alias: string;
  settings: TodoAiSettings;
  defaults: ReturnType<TodoCommandAdapterParams['agent']['getDefaults']>;
  modelChoices: string[];
  message: string | null;
}): WebNodeRoot {
  const models =
    props.settings.model && !props.modelChoices.includes(props.settings.model)
      ? [props.settings.model, ...props.modelChoices]
      : props.modelChoices;

  const action = {
    type: 'command' as const,
    command: props.alias,
    subcommand: 'settings',
    arguments: {},
    options: {},
    surface: 'modal' as const,
    modalTitle: 'Todo AI backend and model selection',
    recordInTimeline: false,
  };

  return {
    kind: 'ui',
    version: 1,
    meta: { command: props.alias, subcommand: 'settings' },
    tree: element('stack', { gap: 'sm' }, [
      ...(props.message
        ? [
            element('text', { tone: 'success', size: 'sm' }, [
              text(props.message),
            ]),
          ]
        : []),
      element(
        'form',
        {
          className: 'web-form web-form--stacked',
          formOptionFieldNames: ['backend', 'model', 'user_instructions'],
          action,
        },
        [
          element('text', { weight: 'semibold', size: 'sm' }, [
            text('AI backend'),
          ]),
          element(
            'select',
            {
              formFieldName: 'backend',
              value: props.settings.backend ?? 'default',
              choices: ['default', 'cursor', 'opencode'],
              choiceLabels: {
                default: `current (${props.defaults.backend})`,
                cursor: 'cursor',
                opencode: 'opencode',
              },
            },
            [],
          ),
          element('text', { weight: 'semibold', size: 'sm' }, [
            text('AI model'),
          ]),
          element(
            'textField',
            {
              formFieldName: 'model',
              value: props.settings.model ?? '',
              inputPlaceholder: props.defaults.effectiveModel,
              choices: ['reset', ...models],
              choiceLabels: { reset: 'Clear / use current' },
            },
            [],
          ),
          element('text', { weight: 'semibold', size: 'sm' }, [
            text('Todo User Instructions'),
          ]),
          element(
            'textArea',
            {
              formFieldName: 'user_instructions',
              value: props.settings.userInstructions,
              inputPlaceholder:
                'Example: Always use uppercase letters when naming parent todo items.',
              maxRows: 10,
            },
            [],
          ),
          element('row', { className: 'web-form__actions', gap: 'xs' }, [
            element('button', { label: 'Save', htmlType: 'submit' }, []),
            element(
              'button',
              {
                label: 'Reset',
                action: { ...action, options: { reset: true } },
              },
              [],
            ),
          ]),
        ],
      ),
    ]),
  };
}

export async function adaptSettingsCommand(
  params: TodoCommandAdapterParams,
): Promise<string | WebNodeRoot> {
  const reset =
    params.parsed.options.reset === true ||
    params.parsed.options.reset === 'true';

  let settings = getTodoAiSettings(params.db);
  let message: string | null = null;

  if (reset) {
    settings = resetTodoAiSettings(params.db);
    message = 'Reset Todo AI settings.';
  } else {
    const backend = parseBackend(params.parsed.options.backend);
    const modelValue = optionalString(params.parsed.options.model);
    const model = modelValue === 'reset' ? null : modelValue;

    const userInstructions = optionalString(
      params.parsed.options.user_instructions,
    );

    const hasUpdates =
      backend !== undefined ||
      model !== undefined ||
      userInstructions !== undefined;

    if (hasUpdates) {
      settings = saveTodoAiSettings(params.db, {
        ...settings,
        backend: backend === undefined ? settings.backend : backend,
        model: model === undefined ? settings.model : model,
        userInstructions:
          userInstructions === undefined
            ? settings.userInstructions
            : (userInstructions ?? ''),
      });

      message = 'Saved Todo AI settings.';
    }
  }

  if (params.source !== 'web') {
    return [message, formatSettings(settings)].filter(Boolean).join('\n\n');
  }

  const modelChoices = await params.agent
    .getAvailableModels({ backend: settings.backend })
    .catch(() => []);

  return renderSettings({
    alias: params.alias,
    settings,
    defaults: params.agent.getDefaults(),
    modelChoices,
    message,
  });
}

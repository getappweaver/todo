import { WorkspaceFileViewV1 } from '@src/capabilities/workspace-file-view.v1';
import type { WebAction, WebNode, WebNodeRoot } from '@src/web/ui-schema';

import type { ShowRepresentation } from '../representation/schema';

type ListContext = {
  arguments: Record<string, unknown>;
  options: Record<string, unknown>;
};

export function parseListContext(value: unknown): ListContext | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const record = parsed as Record<string, unknown>;

    if (
      typeof record.arguments !== 'object' ||
      record.arguments === null ||
      Array.isArray(record.arguments) ||
      typeof record.options !== 'object' ||
      record.options === null ||
      Array.isArray(record.options)
    ) {
      return null;
    }

    return {
      arguments: record.arguments as Record<string, unknown>,
      options: record.options as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

function referenceNode(token: string, consumerAlias: string): WebNode {
  if (token.startsWith('@')) {
    const descriptor = token.slice(1);
    const lineMatch = descriptor.match(/:(\d+)$/);
    const line = lineMatch ? Number(lineMatch[1]) : null;

    const path = lineMatch
      ? descriptor.slice(0, -lineMatch[0].length)
      : descriptor;

    if (
      path.length > 0 &&
      (line === null || (Number.isSafeInteger(line) && line > 0))
    ) {
      return {
        type: 'element',
        tag: 'link',
        props: {
          href: '#',
          action: {
            type: 'capability',
            operation: WorkspaceFileViewV1.operations.view.id,
            input: { path, line },
            consumerAlias,
            selection: 'auto',
            surface: 'timeline',
          },
        },
        children: [{ type: 'text', value: token }],
      };
    }
  } else if (token.startsWith('https://') || token.startsWith('http://')) {
    return {
      type: 'element',
      tag: 'link',
      props: { href: token, external: true },
      children: [{ type: 'text', value: token }],
    };
  }

  return { type: 'text', value: token };
}

export function descriptionNodes(
  description: string,
  consumerAlias: string,
): WebNode[] {
  const nodes: WebNode[] = [];
  const references = /https?:\/\/[^\s<>"']+|@[^\s<>"']+/g;
  let cursor = 0;

  for (const match of description.matchAll(references)) {
    const start = match.index;
    const raw = match[0];

    if (
      raw.startsWith('@') &&
      start > 0 &&
      !/\s/.test(description[start - 1])
    ) {
      continue;
    }

    const token = raw.replace(/[.,;!?)]*$/, '');

    if (!token) {
      continue;
    }

    if (start > cursor) {
      nodes.push({ type: 'text', value: description.slice(cursor, start) });
    }

    nodes.push(referenceNode(token, consumerAlias));
    cursor = start + token.length;
  }

  if (cursor < description.length) {
    nodes.push({ type: 'text', value: description.slice(cursor) });
  }

  return nodes;
}

export function renderShowWeb(
  representation: ShowRepresentation,
  listContext: ListContext | null,
): WebNodeRoot {
  const item = representation.data.item;

  const refresh =
    listContext === null
      ? null
      : {
          command: representation.meta.command,
          subcommand: 'list',
          arguments: listContext.arguments,
          options: listContext.options,
          highlightTargetIds: [`todo-row-${item.id}`],
          target: 'origin' as const,
          recordInTimeline: false,
        };

  const updateAction: WebAction = {
    type: 'command',
    command: representation.meta.command,
    subcommand: 'update',
    arguments: { id: item.id, field: 'description', value: '' },
    options: {},
    recordInTimeline: false,
    ...(refresh === null
      ? {
          refresh: {
            command: representation.meta.command,
            subcommand: 'show',
            arguments: { id: item.id },
            options: {},
            recordInTimeline: false,
          },
        }
      : { surface: 'timeline', refresh }),
  };

  return {
    kind: 'ui',
    version: 1,
    meta: representation.meta,
    stylesheets: [
      {
        id: 'todo-details',
        cssText: `
          .web-stack.todo-details { min-width: min(28rem, 80vw); max-width: 52rem; }
          .web-text.todo-details-preview { overflow-wrap: anywhere; line-height: 1.5; }
          .web-form.todo-details-form { gap: 0.5rem; }
          .web-form.todo-details-form textarea { min-height: 8rem; width: 100%; }
        `,
      },
    ],
    tree: {
      type: 'element',
      tag: 'stack',
      props: { className: 'todo-details', gap: 'sm' },
      children: [
        {
          type: 'element',
          tag: 'text',
          props: { weight: 'bold' },
          children: [{ type: 'text', value: item.text }],
        },
        {
          type: 'element',
          tag: 'text',
          props: { className: 'todo-details-preview', whiteSpace: 'pre-wrap' },
          children: item.description?.trim()
            ? descriptionNodes(item.description, representation.meta.command)
            : [{ type: 'text', value: 'No details yet.' }],
        },
        {
          type: 'element',
          tag: 'form',
          props: {
            className: 'web-form web-form--stacked todo-details-form',
            action: updateAction,
          },
          children: [
            {
              type: 'element',
              tag: 'textArea',
              props: {
                formFieldName: 'value',
                fileSuggestions: true,
                value: item.description ?? '',
                inputPlaceholder: 'Add details, links, or @path/to/file.ts:32',
              },
            },
            {
              type: 'element',
              tag: 'button',
              props: { label: 'Save details', htmlType: 'submit' },
            },
          ],
        },
      ],
    },
  };
}

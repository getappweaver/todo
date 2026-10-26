import type { Database } from 'bun:sqlite';
import { z } from 'zod';

import { ResourceViewV1 } from '@src/capabilities/resource-view.v1';
import { SearchV1 } from '@src/capabilities/search.v1';
import { defineCapabilityProvider } from '@src/capabilities/types';
import type { WebNodeRoot } from '@src/web/ui-schema';

import { isActiveListTodo } from './commands/list/db';
import { handleListCommand } from './commands/list/handler';
import { renderListWeb } from './commands/list/renderers/web';
import { createListRepresentation } from './commands/list/representation/builder';
import { getFocusId, getSubtreeTodoIds, getTodo } from './db/todos';
import { getTodoAiSettings } from './settings';
import type { Todo } from './types/todos';

type ProviderProps = {
  getDb: () => Database;
  alias: string;
  pluginName: string;
};

const CursorSchema = z.object({
  query: z.string(),
  offset: z.number().int().min(0).max(1000000),
});

function hasInactiveAncestorOrSelf(db: Database, todo: Todo): boolean {
  let current: Todo | null = todo;
  const visited = new Set<number>();

  while (current !== null && !visited.has(current.id)) {
    visited.add(current.id);

    if (!isActiveListTodo(current)) {
      return true;
    }

    current =
      current.parent_id === null ? null : getTodo(db, current.parent_id);
  }

  return false;
}

export function todoSearchProviders({
  getDb,
  alias,
  pluginName,
}: ProviderProps) {
  const resourceProviderId = `${pluginName}/resource-view/v1`;

  return [
    defineCapabilityProvider({
      contract: SearchV1,
      operations: {
        [SearchV1.operations.search.id]: ({ input }) => {
          const cursor =
            input.cursor === null
              ? { query: input.query, offset: 0 }
              : CursorSchema.parse(JSON.parse(input.cursor));

          if (cursor.query !== input.query) {
            throw new Error('Search cursor belongs to another query.');
          }

          const db = getDb();
          const escaped = input.query.replace(/[\\%_]/g, '\\$&');

          const rows = db
            .query(
              `SELECT t.id, t.parent_id, t.todo, t.status, t.description, p.todo AS parent_todo
               FROM todos t
               LEFT JOIN todos p ON p.id = t.parent_id
               WHERE t.todo LIKE $query ESCAPE '\\'
                  OR t.description LIKE $query ESCAPE '\\'
                  OR t.tags LIKE $query ESCAPE '\\'
               ORDER BY
                 CASE WHEN lower(t.todo) = lower($exact) THEN 0 ELSE 1 END,
                 CASE
                   WHEN t.status = 'in_progress' THEN 0
                   WHEN t.status = 'pending' THEN 1
                   ELSE 2
                 END,
                 t.created_at DESC,
                 t.id DESC
               LIMIT $limit OFFSET $offset`,
            )
            .all({
              query: `%${escaped}%`,
              exact: input.query,
              limit: input.limit + 1,
              offset: cursor.offset,
            }) as {
            id: number;
            parent_id: number | null;
            todo: string;
            status: string;
            description: string | null;
            parent_todo: string | null;
          }[];

          return {
            results: rows.slice(0, input.limit).map((row) => ({
              id: String(row.id),
              text: row.todo.slice(0, 1000),
              context: [
                `#${row.id}`,
                row.status.replaceAll('_', ' '),
                row.parent_todo,
                row.description,
              ]
                .filter(Boolean)
                .join(' · ')
                .slice(0, 2000),
              address: {
                capability: ResourceViewV1.capability,
                providerId: resourceProviderId,
                resourceType: 'todo',
                resourceId: String(row.id),
                surface: 'timeline' as const,
              },
            })),
            nextCursor:
              rows.length > input.limit
                ? JSON.stringify({
                    query: input.query,
                    offset: cursor.offset + input.limit,
                  })
                : null,
            notices: [],
          };
        },
      },
    }),
    defineCapabilityProvider({
      contract: ResourceViewV1,
      operations: {
        [ResourceViewV1.operations.open.id]: ({ input }) => {
          const id = /^\d+$/.test(input.resourceId)
            ? Number(input.resourceId)
            : NaN;

          const db = getDb();

          const todo =
            input.resourceType === 'todo' && Number.isSafeInteger(id)
              ? getTodo(db, id)
              : null;

          if (!todo) {
            const view: WebNodeRoot = {
              kind: 'ui',
              version: 1,
              meta: { command: alias, subcommand: 'list' },
              tree: {
                type: 'text',
                value: 'Todo not found. It may have been deleted.',
              },
            };

            return { status: 'not-found' as const, view };
          }

          const focusId = getFocusId(db);

          const isOutsideFocusScope =
            focusId !== null && !getSubtreeTodoIds(db, focusId).has(todo.id);

          const listArguments: Record<string, unknown> = isOutsideFocusScope
            ? { rootId: null }
            : {};

          const listOptions: Record<string, unknown> =
            hasInactiveAncestorOrSelf(db, todo)
              ? { status: ['pending', 'in_progress', 'done'] }
              : {};

          const listResult = handleListCommand({
            prefix: '/',
            alias,
            db,
            arguments: listArguments,
            options: listOptions,
          });

          const representation =
            listResult.type === 'success'
              ? createListRepresentation({
                  command: alias,
                  subcommand: 'list',
                  scope: listResult.scope,
                  view: listResult.view,
                  showDescriptions: listResult.showDescriptions,
                  listInvocation: {
                    arguments: {},
                    options: listOptions,
                  },
                  priorityPrompt: listResult.priorityPrompt,
                  items: listResult.items,
                })
              : createListRepresentation({
                  command: alias,
                  subcommand: 'list',
                  scope: null,
                  view: 'tree',
                  showDescriptions: false,
                  listInvocation: {
                    arguments: {},
                    options: listOptions,
                  },
                  priorityPrompt: null,
                  items: [],
                });

          return {
            status: 'found' as const,
            title: todo.todo,
            view: renderListWeb(representation, {
              prefix: '/',
              aiSettings: getTodoAiSettings(db),
              focusedTodoId: todo.id,
            }),
          };
        },
      },
    }),
  ];
}

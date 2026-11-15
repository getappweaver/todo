import type { WebNodeRoot } from '@src/web/ui-schema';

import { reorderRoots } from '../../db/root-order';
import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { adaptListCommand } from '../list/adapter';

function parseItemIds(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];

  return list.map((value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`Invalid todo ID in order: ${String(value)}`);
    }

    return id;
  });
}

export function adaptOrderCommand(
  params: TodoCommandAdapterParams,
): string | WebNodeRoot {
  const revision =
    typeof params.parsed.options.revision === 'string'
      ? params.parsed.options.revision
      : '';

  const order = parseItemIds(params.parsed.options.items);

  reorderRoots({
    db: params.db,
    order,
    revision,
  });

  if (params.source === 'web') {
    const listOptions: typeof params.parsed.options = {
      ...params.parsed.options,
      prioritize: true,
    };

    delete listOptions.revision;
    delete listOptions.items;

    return adaptListCommand({
      ...params,
      parsed: {
        ...params.parsed,
        subcommand: 'list',
        arguments: {},
        options: listOptions,
      },
    });
  }

  return 'Updated root todo order.';
}

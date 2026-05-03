import { C } from '@src/logger';
import type { TextRenderContext } from '@src/system/render-context';

import type {
  ListItem,
  ListRepresentation,
  ListScope,
} from '../representation/schema';

const STATUS_ICON: Record<string, string> = {
  pending: '[ ]',
  in_progress: '[~]',
  done: '[x]',
  cancelled: '[-]',
};

function formatWinRate(todo: {
  win_rate: number | null;
  wins: number;
  losses: number;
}): string {
  if (todo.win_rate === null) {
    return 'unscored';
  }

  const pct = Math.round(todo.win_rate * 100);

  return `${pct}%  ${todo.wins}W/${todo.losses}L`;
}

export function formatListScopeTitleLine(params: { scope: ListScope }): string {
  const safeTitle =
    params.scope.rootTitle.replace(/\s+/g, ' ').trim() || '(unknown)';

  return `Focus to: #${params.scope.rootId} "${safeTitle}"`;
}

export function formatListScopeHeader(params: {
  scope: ListScope;
  commandPrefix: string;
  commandAlias: string;
}): string {
  return [
    formatListScopeTitleLine({ scope: params.scope }),
    `type "${params.commandPrefix}${params.commandAlias} unfocus" to return to top-level`,
  ].join('\n');
}

function renderFlatListLine(item: ListItem): string {
  const icon = (STATUS_ICON[item.status] ?? '[ ]').padEnd(4);

  const rate = formatWinRate({
    win_rate: item.winRate,
    wins: item.wins,
    losses: item.losses,
  });

  return `${C.bold}#${item.id}${C.reset} ${icon} ${item.text} (${rate})`;
}

function renderTree(
  representation: ListRepresentation,
  context: TextRenderContext,
): string {
  const lines = representation.data.items.flatMap((item) => {
    const prefix = '  '.repeat(item.depth + 1);
    const icon = STATUS_ICON[item.status] ?? '[ ]';

    const rate = formatWinRate({
      win_rate: item.winRate,
      wins: item.wins,
      losses: item.losses,
    });

    const out = [`${prefix}- ${icon} ${item.text} (${rate})  (id: ${item.id})`];

    if (representation.data.showDescriptions && item.description?.trim()) {
      const descIndent = prefix + ' '.repeat('- '.length + icon.length + 1);

      for (const line of item.description.trim().split('\n')) {
        out.push(`${descIndent}${line}`);
      }
    }

    return out;
  });

  const header = representation.data.scope
    ? formatListScopeHeader({
        scope: representation.data.scope,
        commandPrefix: context.prefix,
        commandAlias: representation.meta.command,
      })
    : null;

  return [header, lines.join('\n')]
    .filter((value) => value && value.length > 0)
    .join('\n');
}

export function renderListText(
  representation: ListRepresentation,
  context: TextRenderContext,
): string {
  const header = representation.data.scope
    ? formatListScopeHeader({
        scope: representation.data.scope,
        commandPrefix: context.prefix,
        commandAlias: representation.meta.command,
      })
    : null;

  if (representation.data.items.length === 0) {
    return header ?? 'No todos.';
  }

  if (representation.data.view === 'flat') {
    const lines = representation.data.items.map(renderFlatListLine).join('\n');

    return [header, lines]
      .filter((value) => value && value.length > 0)
      .join('\n');
  }

  return renderTree(representation, context);
}

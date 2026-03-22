// ---------------------------------------------------------------------------
// todos/format.ts — Display helpers for todos
// ---------------------------------------------------------------------------
import { formatWinRate } from './duel';
import type { CreateTodoDraft, Todo, TodoWithWinStats } from './types';

const BULLET = '- ';

function draftTreeLines(node: CreateTodoDraft, prefix: string): string[] {
  const lines: string[] = [];

  lines.push(`${prefix}${BULLET}${node.todo}`);

  const extraIndent = prefix + ' '.repeat(BULLET.length);

  const desc = node.description?.trim();

  if (desc) {
    for (const line of desc.split('\n')) {
      lines.push(`${extraIndent}${line}`);
    }
  }

  if (node.tags?.length) {
    lines.push(`${extraIndent}tags: ${node.tags.join(', ')}`);
  }

  const children = node.children ?? [];

  children.forEach((child: CreateTodoDraft) => {
    lines.push(...draftTreeLines(child, prefix + '  '));
  });

  return lines;
}

/** Whether the draft node has children (tree vs single item). */
export function hasDraftChildren(node: CreateTodoDraft): boolean {
  return (node.children?.length ?? 0) > 0;
}

const REPLY_LABEL = 'Reply: ';

/** Multi-line reply lines for draft accept/revise/decline. */
export function formatDraftReply(
  cmd: string,
  id: number,
  kind: 'create' | 'update' | 'delete',
  blockPrefix: string = '',
): string {
  const pad = blockPrefix + ' '.repeat(REPLY_LABEL.length);
  const first = blockPrefix + REPLY_LABEL;

  if (kind === 'delete') {
    return [first + `${cmd} accept ${id}`, pad + `${cmd} decline ${id}`].join(
      '\n',
    );
  }

  return [
    first + `${cmd} accept ${id}`,
    pad + `${cmd} revise ${id} <corrections>`,
    pad + `${cmd} decline ${id}`,
  ].join('\n');
}

/** Format a create-draft tree for display (e.g. !todo drafts <id>). */
export function formatCreateDraftTree(node: CreateTodoDraft): string {
  return draftTreeLines(node, '  ').join('\n');
}

const STATUS_ICON: Record<string, string> = {
  pending: '[ ]',
  in_progress: '[~]',
  done: '[x]',
  cancelled: '[-]',
};

function buildChildMap(todos: Todo[]): Map<number | null, Todo[]> {
  const map = new Map<number | null, Todo[]>();

  for (const t of todos) {
    const key = t.parent_id ?? null;

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key)!.push(t);
  }

  return map;
}

function winLine(t: Todo): string {
  const w = t as TodoWithWinStats;

  if (
    w.win_rate === undefined &&
    w.wins === undefined &&
    w.losses === undefined
  ) {
    return '';
  }

  return ` (${formatWinRate({
    win_rate: w.win_rate ?? null,
    wins: w.wins ?? 0,
    losses: w.losses ?? 0,
  })})`;
}

export function formatTodoTree(
  todos: Todo[],
  showDescriptions: boolean,
  subtreeRootId?: number | null,
): string {
  if (todos.length === 0) {
    return 'No todos.';
  }

  const toRender =
    subtreeRootId != null
      ? todos.map((t) =>
          t.id === subtreeRootId ? { ...t, parent_id: null } : t,
        )
      : todos;

  const childMap = buildChildMap(toRender);
  const lines: string[] = [];

  function render(parentId: number | null, prefix: string) {
    const children = childMap.get(parentId) ?? [];

    children.forEach((t) => {
      const icon = STATUS_ICON[t.status] ?? '[ ]';
      const runIn = `${BULLET}${icon} `;
      const extra = winLine(t);

      lines.push(`${prefix}${runIn}${t.todo}${extra}  (id: ${t.id})`);

      if (showDescriptions && t.description?.trim()) {
        const descIndent = prefix + ' '.repeat(runIn.length);
        const descLines = t.description.trim().split('\n');
        for (const line of descLines) {
          lines.push(`${descIndent}${line}`);
        }
      }

      render(t.id, prefix + '  ');
    });
  }

  render(null, '  ');

  return lines.join('\n');
}

export function formatTodoDetail(t: Todo): string {
  const lines = [
    `ID:          ${t.id}`,
    `Todo:        ${t.todo}`,
    `Status:      ${t.status}`,
    `Parent:      ${t.parent_id ?? '(top-level)'}`,
    `Tags:        ${t.tags?.join(', ') ?? '—'}`,
    `Description: ${t.description ?? '—'}`,
    `Created:     ${new Date(t.created_at).toLocaleString()}`,
    `Updated:     ${t.updated_at ? new Date(t.updated_at).toLocaleString() : '—'}`,
    `Completed:   ${t.completed_at ? new Date(t.completed_at).toLocaleString() : '—'}`,
  ];

  return lines.join('\n');
}

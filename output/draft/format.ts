import type { CreateTodoDraft, TodoDraftRow } from '../../types/drafts';
import type { Todo, UpdateTodoInput } from '../../types/todos';

import { formatTodoDetail } from '../todo-detail/format';

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

  for (const child of node.children ?? []) {
    lines.push(...draftTreeLines(child, prefix + '  '));
  }

  return lines;
}

export function hasDraftChildren(node: CreateTodoDraft): boolean {
  return (node.children?.length ?? 0) > 0;
}

const REPLY_LABEL = 'Reply: ';

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

export function formatCreateDraftTree(node: CreateTodoDraft): string {
  return draftTreeLines(node, '  ').join('\n');
}

function formatVal(v: string | number | string[] | null | undefined): string {
  if (v === undefined || v === null) {
    return '(none)';
  }

  if (Array.isArray(v)) {
    return v.length ? `[${v.join(', ')}]` : '(none)';
  }

  return String(v);
}

function formatUpdateBlockLines(
  current: Todo | null,
  input: UpdateTodoInput,
): string[] {
  const old = (key: keyof Todo) => (current ? current[key] : undefined);
  const lines: string[] = [];

  lines.push(
    input.todo !== undefined
      ? `todo: ${formatVal(old('todo'))} -> "${input.todo}"`
      : `todo: ${formatVal(old('todo'))}`,
  );

  lines.push(
    input.description !== undefined
      ? `description: ${formatVal(old('description'))} -> ${input.description === null ? '(clear)' : `"${input.description}"`}`
      : `description: ${formatVal(old('description'))}`,
  );

  lines.push(
    input.status !== undefined
      ? `status: ${formatVal(old('status'))} -> ${input.status}`
      : `status: ${formatVal(old('status'))}`,
  );

  const oldTags = current?.tags ?? null;
  const oldStr = oldTags?.length ? `[${oldTags.join(', ')}]` : '(none)';

  lines.push(
    input.tags !== undefined
      ? `tags: ${oldStr} -> ${input.tags === null ? '(clear)' : `[${input.tags.join(', ')}]`}`
      : `tags: ${oldStr}`,
  );

  return lines;
}

export function formatCreateDraftPreview(params: {
  draftId: number;
  input: CreateTodoDraft;
  cmd: string;
}): string {
  const title = hasDraftChildren(params.input)
    ? "I'm going to create the following todo tree:"
    : "I'm going to create the following todo item:";

  return [
    `You can accept all below by ${params.cmd} accept all`,
    '',
    title,
    '',
    formatCreateDraftTree(params.input),
    '',
    `Draft ID: ${params.draftId}`,
    formatDraftReply(params.cmd, params.draftId, 'create'),
  ].join('\n');
}

export function formatDraftBlock(params: {
  draft: TodoDraftRow;
  cmd: string;
  currentTodo: Todo | null;
}): string {
  if (params.draft.kind === 'create') {
    return [
      `#${params.draft.id} [create]:`,
      '',
      formatCreateDraftTree(params.draft.input),
      '',
      formatDraftReply(params.cmd, params.draft.id, 'create', '  '),
    ].join('\n');
  }

  if (params.draft.kind === 'update') {
    const lines = formatUpdateBlockLines(
      params.currentTodo,
      params.draft.input,
    );

    return [
      `#${params.draft.id} [update]:`,
      '',
      `target: #${params.draft.input.id}`,
      ...lines,
      '',
      formatDraftReply(params.cmd, params.draft.id, 'update', '  '),
    ].join('\n');
  }

  return `#${params.draft.id} [delete] | todo id: ${params.draft.input.id}`;
}

export function formatDraftDetail(params: {
  draft: TodoDraftRow;
  cmd: string;
  currentTodo: Todo | null;
}): string {
  if (params.draft.kind === 'create') {
    return [
      `You can accept all below by ${params.cmd} accept all`,
      '',
      `Draft #${params.draft.id} [create]:`,
      '',
      formatCreateDraftTree(params.draft.input),
      '',
      `  prompt      : ${params.draft.originalPrompt}`,
      '',
      formatDraftReply(params.cmd, params.draft.id, 'create', '  '),
    ].join('\n');
  }

  if (params.draft.kind === 'update') {
    const targetLine = params.currentTodo
      ? `  target      : #${params.draft.input.id} "${params.currentTodo.todo}"`
      : `  target      : #${params.draft.input.id}`;

    const fieldLines = Object.entries(params.draft.input)
      .filter(([key, value]) => key !== 'id' && value !== undefined)
      .map(([key, value]) => {
        const val =
          value === null
            ? '—'
            : Array.isArray(value)
              ? value.join(', ')
              : String(value);

        const oldVal =
          params.currentTodo && (key === 'status' || key === 'todo')
            ? ((params.currentTodo as Record<string, unknown>)[key] ?? '—')
            : null;

        const oldStr = oldVal !== null ? `${oldVal} → ` : '';

        return `  ${key.padEnd(12)}: ${oldStr}${val}`;
      });

    return [
      `Draft #${params.draft.id} [update]:`,
      targetLine,
      ...(fieldLines.length > 0 ? fieldLines : ['  (no fields set)']),
      `  prompt      : ${params.draft.originalPrompt}`,
      '',
      formatDraftReply(params.cmd, params.draft.id, 'update', '  '),
    ].join('\n');
  }

  return [
    `Draft #${params.draft.id} [delete]:`,
    `  target todo id: ${params.draft.input.id}`,
    `  prompt        : ${params.draft.originalPrompt}`,
    '',
    formatDraftReply(params.cmd, params.draft.id, 'delete', '  '),
  ].join('\n');
}

export function formatAcceptedCreateDraftResult(todos: Todo[]): string {
  const root = todos[0]!;

  if (todos.length === 1) {
    return `Todo created: #${root.id}\n${formatTodoDetail(root)}`;
  }

  const summary = todos.map((todo) => `#${todo.id} ${todo.todo}`).join('\n  ');

  return `Created ${todos.length} todos:\n  ${summary}`;
}

export function formatAcceptedAllDraftsResult(params: {
  results: string[];
  errors: string[];
}): string {
  const lines = [`Accepted ${params.results.length} draft(s):`];

  if (params.results.length > 0) {
    lines.push(...params.results.map((result) => `  ✓ ${result}`));
  }

  if (params.errors.length > 0) {
    lines.push(
      '',
      `Skipped ${params.errors.length}:`,
      ...params.errors.map((error) => `  ✗ ${error}`),
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// plugins/todo/commands.ts — !todo sub-command handler
// ---------------------------------------------------------------------------

import type { Database } from 'bun:sqlite';

import type { AgentRunResult } from '@src/backends/types';
import { getOutputString } from '@src/backends/types';
import type { PluginIdentity } from '@src/core/plugin';
import { C } from '@src/logger';

import { handleTodoAi } from './ai';
import { parseTodoToolCalls, buildSystemPrompt } from './ai';
import {
  clearFocusId,
  createTodo,
  createTodosFromDraftTree,
  deleteTodo,
  doneTodo,
  getFocusId,
  getTodo,
  listTodos,
  listTodosInSubtree,
  setFocusId,
  updateTodo,
} from './db';
import { deleteDraft, getDraft, listDrafts, storeDraft } from './drafts';
import {
  handleDuelCommand,
  handleNextCommand,
  maybeOfferDuelAfterAdd,
  formatWinRate,
} from './duel';
import {
  formatCreateDraftTree,
  formatDraftReply,
  hasDraftChildren,
} from './format';
import { formatTodoDetail, formatTodoTree } from './format';
import type {
  CreateTodoDraft,
  Todo,
  TodoWithWinStats,
  UpdateTodoInput,
} from './types';
import { TodoStatusSchema } from './types';

// ---------------------------------------------------------------------------
// List helpers
// ---------------------------------------------------------------------------

/** Depth in the todo tree: 0 = top-level (`parent_id` null), 1 = direct child of a root, etc. */
function treeDepth(db: Database, t: Todo): number {
  let d = 0;
  let pid = t.parent_id;

  while (pid !== null) {
    d++;
    const p = getTodo(db, pid);

    if (!p) {
      break;
    }

    pid = p.parent_id;
  }

  return d;
}

function extractListPositionals(rest: string[]): string[] {
  const out: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];

    if (a.startsWith('--')) {
      if (a === '--level' && rest[i + 1] !== undefined) {
        i++;
      }

      continue;
    }

    out.push(a);
  }

  return out;
}

function looksLikeTodoIdToken(token: string): boolean {
  return /^\d+$/.test(token.trim());
}

const STATUS_ICON: Record<string, string> = {
  pending: '[ ]',
  in_progress: '[~]',
  done: '[x]',
  cancelled: '[-]',
};

/** Aligned flat rows (same idea as `lbl` + columns in `getStatusLines`). */
function formatFlatTodoListLines(todos: TodoWithWinStats[]): string {
  const idCol = Math.max(4, ...todos.map((t) => `#${t.id}`.length));
  const iconCol = 4;

  const lblId = (id: number) => `${C.bold}${`#${id}`.padEnd(idCol)}${C.reset}`;

  return todos
    .map((t) => {
      const icon = (STATUS_ICON[t.status] ?? '[ ]').padEnd(iconCol);

      const rate = formatWinRate({
        win_rate: t.win_rate,
        wins: t.wins,
        losses: t.losses,
      });

      return `${lblId(t.id)} ${icon} ${t.todo} (${rate})`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Preview formatting
// ---------------------------------------------------------------------------

function formatVal(v: string | number | string[] | null | undefined): string {
  if (v === undefined || v === null) {
    return '(none)';
  }

  if (Array.isArray(v)) {
    return v.length ? `[${v.join(', ')}]` : '(none)';
  }

  return String(v);
}

function formatUpdateChanges(
  current: Todo | null,
  input: UpdateTodoInput,
): string[] {
  const parts: string[] = [];
  const old = (key: keyof Todo) => (current ? current[key] : undefined);

  if (input.todo !== undefined) {
    parts.push(`todo: ${formatVal(old('todo'))} -> "${input.todo}"`);
  }

  if (input.status !== undefined) {
    parts.push(`status: ${formatVal(old('status'))} -> ${input.status}`);
  }

  if (input.description !== undefined) {
    const newVal =
      input.description === null ? '(clear)' : `"${input.description}"`;

    parts.push(`description: ${formatVal(old('description'))} -> ${newVal}`);
  }

  if (input.tags !== undefined) {
    const oldTags = current?.tags ?? null;
    const oldStr = oldTags?.length ? `[${oldTags.join(', ')}]` : '(none)';

    const newStr =
      input.tags === null ? '(clear)' : `[${input.tags.join(', ')}]`;

    parts.push(`tags: ${oldStr} -> ${newStr}`);
  }

  return parts;
}

/** All target fields for the update block: show current value, or "old -> new" when that field is in the update. */
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

function formatDraftPreview(
  id: number,
  input: CreateTodoDraft,
  cmd: string,
): string {
  const title = hasDraftChildren(input)
    ? "I'm going to create the following todo tree:"
    : "I'm going to create the following todo item:";

  return [
    `You can accept all below by ${cmd} accept all`,
    ``,
    title,
    ``,
    formatCreateDraftTree(input),
    ``,
    `Draft ID: ${id}`,
    formatDraftReply(cmd, id, 'create'),
  ].join('\n');
}

function formatDraftRow(
  id: number,
  entry: {
    kind: string;
    input:
      | { todo?: string; id?: number; priority?: string | null }
      | UpdateTodoInput;
  },
  db: Database,
): string {
  if (entry.kind === 'create') {
    const inp = entry.input as { todo?: string };

    return `#${id} [create] | ${inp.todo ?? '—'} | tree`;
  }

  if (entry.kind === 'update') {
    const inp = entry.input as UpdateTodoInput;
    const current = getTodo(db, inp.id);
    const changes = formatUpdateChanges(current, inp);
    const summary = changes.length > 0 ? changes.join(', ') : '—';

    return `#${id} [update] | target: #${inp.id} | ${summary}`;
  }

  return `#${id} [${entry.kind}] | todo id: ${(entry.input as { id: number }).id}`;
}

function formatDraftBlock(
  draft: {
    id: number;
    kind: string;
    input:
      | CreateTodoDraft
      | { id: number; todo?: string; [k: string]: unknown };
    originalPrompt: string;
  },
  cmd: string,
  db: Database,
): string {
  if (draft.kind === 'create') {
    const c = draft.input as CreateTodoDraft;

    return [
      `#${draft.id} [create]:`,
      ``,
      formatCreateDraftTree(c),
      ``,
      formatDraftReply(cmd, draft.id, 'create', '  '),
    ].join('\n');
  }

  if (draft.kind === 'update') {
    const inp = draft.input as UpdateTodoInput;
    const current = getTodo(db, inp.id);
    const lines = formatUpdateBlockLines(current, inp);

    return [
      `#${draft.id} [update]:`,
      ``,
      `target: #${inp.id}`,
      ...lines,
      ``,
      formatDraftReply(cmd, draft.id, 'update', '  '),
    ].join('\n');
  }

  return formatDraftRow(draft.id, draft, db);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export type HandleTodoProps = {
  args: string[];
  db: Database;
  identity: PluginIdentity;
  runAgent: ((prompt: string) => Promise<AgentRunResult>) | null;
  helpText: (alias: string) => string[];
  promptFn: (message: string) => Promise<string>;
  sendReply: (message: string) => Promise<void>;
};

export async function handleTodo({
  args,
  db,
  identity,
  runAgent,
  helpText,
  promptFn,
  sendReply,
}: HandleTodoProps): Promise<string> {
  const sub = args[0]?.toLowerCase();
  const rest = args.slice(1);

  const alias = identity.alias;

  if (!sub || sub === 'help') {
    return helpText(alias).join('\n');
  }

  // --- AI ---
  if (sub === 'ai') {
    if (!runAgent) {
      return `!${alias} ai requires an agent backend. Set backend (e.g. !backend opencode-sdk) and try again.`;
    }

    return handleTodoAi({ args: args.slice(1), db, identity, runAgent });
  }

  // --- duel ---
  if (sub === 'duel') {
    return handleDuelCommand({
      args: rest,
      db,
      sendReply,
      promptFn,
    });
  }

  // --- next ---
  if (sub === 'next') {
    return handleNextCommand({
      args: rest,
      db,
      sendReply,
      promptFn,
    });
  }

  // --- focus ---
  if (sub === 'focus') {
    const raw = rest[0]?.trim();

    if (!raw) {
      return `Usage: !${alias} focus <id|clear>`;
    }

    if (raw.toLowerCase() === 'clear') {
      clearFocusId(db);

      return `Focus cleared.`;
    }

    const id = parseInt(raw, 10);

    if (Number.isNaN(id) || id <= 0) {
      return `Usage: !${alias} focus <id|clear>`;
    }

    const todo = getTodo(db, id);

    if (!todo) {
      return `Todo not found: #${id}`;
    }

    setFocusId(db, id);

    return `Focus set to #${id}: ${todo.todo}`;
  }

  // --- unfocus (delete focus row) ---
  if (sub === 'unfocus') {
    clearFocusId(db);

    return `Focus cleared.`;
  }

  // --- add ---
  if (sub === 'add') {
    const underIdx = rest.findIndex((a) => a.toLowerCase() === 'under');
    let text: string;
    let parentId: number | null = null;

    if (underIdx !== -1) {
      text = rest.slice(0, underIdx).join(' ').trim();
      const raw = rest[underIdx + 1]?.trim();
      parentId = raw ? parseInt(raw, 10) : null;

      if (raw && Number.isNaN(parentId!)) {
        return 'Invalid parent_id. Use a number (e.g. under 2).';
      }
    } else {
      text = rest.join(' ').trim();
    }

    if (!text) {
      return `Usage: !${alias} add <text> [under <parent_id>]`;
    }

    if (parentId != null && !getTodo(db, parentId)) {
      return `Parent todo not found: #${parentId}`;
    }

    const todo = createTodo(
      db,
      {
        todo: text,
        parent_id: parentId,
        description: null,
        tags: null,
      },
      'dm',
    );

    const lines = [`Todo created: #${todo.id}\n${formatTodoDetail(todo)}`];

    const duelMsg = await maybeOfferDuelAfterAdd({
      db,
      parentId: todo.parent_id ?? null,
      newId: todo.id,
      newTitle: todo.todo,
      sendReply,
      promptFn,
    });

    if (duelMsg) {
      lines.push('', duelMsg);
    }

    return lines.join('\n');
  }

  // --- list ---
  if (sub === 'list') {
    const flat = rest.includes('--flat');
    const showDesc = rest.includes('--desc');
    const levelIdx = rest.indexOf('--level');
    let level: number | null = null;

    if (levelIdx !== -1) {
      const raw = rest[levelIdx + 1]?.trim();
      const n = raw !== undefined ? parseInt(raw, 10) : NaN;

      if (raw === undefined || Number.isNaN(n) || n < 0) {
        return `Usage: !${alias} list [<id>] [pending|done|all] [--flat] [--desc] [--level <n>] (n >= 0)`;
      }

      level = n;
    }

    const positionals = extractListPositionals(rest);
    let rootId: number | null = null;
    let filterStart = 0;

    if (positionals.length > 0 && looksLikeTodoIdToken(positionals[0])) {
      const n = parseInt(positionals[0], 10);

      if (n > 0) {
        rootId = n;
        filterStart = 1;
      } else {
        return `Invalid todo id: ${positionals[0]}`;
      }
    } else {
      rootId = getFocusId(db);
    }

    const filterArg = positionals[filterStart]?.toLowerCase();

    if (rootId !== null && !getTodo(db, rootId)) {
      return `Todo not found: #${rootId}`;
    }

    let todos =
      rootId === null ? listTodos(db) : listTodosInSubtree(db, rootId);

    if (!filterArg || filterArg === 'pending') {
      todos = todos.filter(
        (t) => t.status !== 'done' && t.status !== 'cancelled',
      );
    } else if (filterArg !== 'all') {
      todos = todos.filter((t) => t.status === filterArg);
    }

    if (level !== null) {
      todos = todos.filter((t) => treeDepth(db, t) === level);
    }

    if (todos.length === 0) {
      return 'No todos matching filter.';
    }

    if (flat || level !== null) {
      return formatFlatTodoListLines(todos);
    }

    return formatTodoTree(
      todos,
      showDesc,
      rootId === null ? undefined : rootId,
    );
  }

  // --- show ---
  if (sub === 'show') {
    const idRaw = rest[0]?.trim();

    if (!idRaw) {
      return `Usage: !${alias} show <id>`;
    }

    const id = parseInt(idRaw, 10);

    if (Number.isNaN(id)) {
      return `Usage: !${alias} show <id> (id must be a number)`;
    }

    const todo = getTodo(db, id);

    if (!todo) {
      return `Todo not found: #${id}`;
    }

    return formatTodoDetail(todo);
  }

  // --- done ---
  if (sub === 'done') {
    const idRaw = rest[0]?.trim();

    if (!idRaw) {
      return `Usage: !${alias} done <id>`;
    }

    const id = parseInt(idRaw, 10);

    if (Number.isNaN(id)) {
      return `Usage: !${alias} done <id> (id must be a number)`;
    }

    if (!doneTodo(db, id)) {
      return `Todo not found: #${id}`;
    }

    return `Todo #${id} marked done (and all descendants).`;
  }

  // --- start ---
  if (sub === 'start') {
    const idRaw = rest[0]?.trim();

    if (!idRaw) {
      return `Usage: !${alias} start <id>`;
    }

    const id = parseInt(idRaw, 10);

    if (Number.isNaN(id)) {
      return `Usage: !${alias} start <id> (id must be a number)`;
    }

    const updated = updateTodo(db, { id, status: 'in_progress' });

    if (!updated) {
      return `Todo not found: #${id}`;
    }

    return `Todo #${id} set to in progress.`;
  }

  // --- update ---
  if (sub === 'update') {
    const idRaw = rest[0]?.trim();

    if (!idRaw) {
      return `Usage: !${alias} update <id> <field> <value>`;
    }

    const id = parseInt(idRaw, 10);

    if (Number.isNaN(id)) {
      return `Usage: !${alias} update <id> <field> <value> (id must be a number)`;
    }

    const field = rest[1]?.toLowerCase();
    const value = rest.slice(2).join(' ').trim();

    if (!field || !value) {
      return `Usage: !${alias} update <id> <field> <value>`;
    }

    if (!getTodo(db, id)) {
      return `Todo not found: #${id}`;
    }

    switch (field) {
      case 'todo':
      case 'title': {
        const updated = updateTodo(db, { id, todo: value });

        return `Todo updated.\n${formatTodoDetail(updated!)}`;
      }

      case 'status': {
        const statusParsed = TodoStatusSchema.safeParse(value);

        if (!statusParsed.success) {
          return 'Status must be: pending, in_progress, done, or cancelled';
        }

        const updated = updateTodo(db, { id, status: statusParsed.data });

        return `Status updated.\n${formatTodoDetail(updated!)}`;
      }

      case 'description': {
        const updated = updateTodo(db, { id, description: value });

        return `Description updated.\n${formatTodoDetail(updated!)}`;
      }

      default:
        return `Unknown field: ${field}. Supported: todo, status, description`;
    }
  }

  // --- delete ---
  if (sub === 'delete') {
    const idRaw = rest[0]?.trim();

    if (!idRaw) {
      return `Usage: !${alias} delete <id>`;
    }

    const id = parseInt(idRaw, 10);

    if (Number.isNaN(id)) {
      return `Usage: !${alias} delete <id> (id must be a number)`;
    }

    if (!deleteTodo(db, id)) {
      return `Todo not found: #${id}`;
    }

    return `Todo #${id} deleted (and all descendants).`;
  }

  // --- drafts ---
  if (sub === 'drafts') {
    const idRaw = rest[0]?.trim();

    if (idRaw) {
      const id = parseInt(idRaw, 10);

      if (Number.isNaN(id)) {
        return `Usage: !${alias} drafts [draft_id] (draft_id must be a number)`;
      }

      const entry = getDraft(db, id);

      if (!entry) {
        return `Draft not found: #${id}`;
      }

      const cmd = `!${alias}`;

      if (entry.kind === 'create') {
        const c = entry.input;

        return [
          `You can accept all below by ${cmd} accept all`,
          ``,
          `Draft #${id} [create]:`,
          ``,
          formatCreateDraftTree(c),
          ``,
          `  prompt      : ${entry.originalPrompt}`,
          ``,
          formatDraftReply(cmd, id, 'create', '  '),
        ].join('\n');
      }

      if (entry.kind === 'update') {
        const u = entry.input;

        const existing = getTodo(db, u.id);

        const targetLine = existing
          ? `  target      : #${u.id} "${existing.todo}"`
          : `  target      : #${u.id}`;

        const fieldLines = Object.entries(u)
          .filter(([k, v]) => k !== 'id' && v !== undefined)
          .map(([k, v]) => {
            const val =
              v === null ? '—' : Array.isArray(v) ? v.join(', ') : String(v);

            const oldVal =
              existing && (k === 'status' || k === 'todo')
                ? ((existing as Record<string, unknown>)[k] ?? '—')
                : null;

            const oldStr = oldVal !== null ? `${oldVal} → ` : '';

            return `  ${k.padEnd(12)}: ${oldStr}${val}`;
          });

        return [
          `Draft #${id} [update]:`,
          targetLine,
          ...(fieldLines.length > 0 ? fieldLines : ['  (no fields set)']),
          `  prompt      : ${entry.originalPrompt}`,
          ``,
          formatDraftReply(cmd, id, 'update', '  '),
        ].join('\n');
      }

      // delete draft
      return [
        `Draft #${id} [delete]:`,
        `  target todo id: ${entry.input.id}`,
        `  prompt        : ${entry.originalPrompt}`,
        ``,
        formatDraftReply(cmd, id, 'delete', '  '),
      ].join('\n');
    }

    const drafts = listDrafts(db);

    if (drafts.length === 0) {
      return `No pending drafts.`;
    }

    const cmd = `!${alias}`;
    const header = `You can accept all below by ${cmd} accept all`;
    const blocks = drafts.map((d) => formatDraftBlock(d, cmd, db));

    return [
      `Pending drafts (${drafts.length}):`,
      ``,
      header,
      ``,
      blocks.join('\n\n'),
    ].join('\n');
  }

  // --- parse draft id for accept/revise/decline ---
  const draftIdRaw = rest[0]?.trim();
  const draftId = draftIdRaw ? parseInt(draftIdRaw, 10) : NaN;
  const draftIdInvalid = !draftIdRaw || Number.isNaN(draftId);

  // --- accept ---
  if (sub === 'accept') {
    // accept all
    if (rest[0]?.toLowerCase() === 'all') {
      const drafts = listDrafts(db);

      if (drafts.length === 0) {
        return 'No pending drafts.';
      }

      const results: string[] = [];
      const errors: string[] = [];

      for (const draft of drafts) {
        switch (draft.kind) {
          case 'create': {
            deleteDraft(db, draft.id);

            const created = createTodosFromDraftTree(db, draft.input, 'dm');

            if (created.length === 1) {
              results.push(`#${created[0].id} ${created[0].todo}`);
            } else {
              const n = created.length - 1;

              results.push(
                `#${created[0].id} ${created[0].todo} (+ ${n} ${n === 1 ? 'child' : 'children'})`,
              );
            }

            break;
          }

          case 'update': {
            deleteDraft(db, draft.id);

            const updated = updateTodo(db, draft.input);

            if (!updated) {
              errors.push(
                `Draft #${draft.id}: todo #${draft.input.id} not found — skipped`,
              );
            } else {
              results.push(`#${updated.id} updated`);
            }

            break;
          }

          case 'delete': {
            deleteDraft(db, draft.id);

            if (!deleteTodo(db, draft.input.id)) {
              errors.push(
                `Draft #${draft.id}: todo #${draft.input.id} not found — skipped`,
              );
            } else {
              results.push(`#${draft.input.id} deleted`);
            }

            break;
          }
        }
      }

      const lines = [`Accepted ${results.length} draft(s):`];

      if (results.length > 0) {
        lines.push(...results.map((r) => `  ✓ ${r}`));
      }

      if (errors.length > 0) {
        lines.push(
          '',
          `Skipped ${errors.length}:`,
          ...errors.map((e) => `  ✗ ${e}`),
        );
      }

      return lines.join('\n');
    }

    // single accept
    if (draftIdInvalid) {
      return `Usage: !${alias} accept <draft_id> | !${alias} accept all`;
    }

    const entry = getDraft(db, draftId);

    if (!entry) {
      return `Draft not found: #${draftId}`;
    }

    if (entry.kind === 'create') {
      const created = createTodosFromDraftTree(db, entry.input, 'dm');

      deleteDraft(db, draftId);

      const root = created[0];

      if (created.length === 1) {
        return `Todo created: #${root.id}\n${formatTodoDetail(root)}`;
      }

      const summary = created.map((t) => `#${t.id} ${t.todo}`).join('\n  ');

      return `Created ${created.length} todos:\n  ${summary}`;
    }

    deleteDraft(db, draftId);

    switch (entry.kind) {
      case 'update': {
        const updated = updateTodo(db, entry.input);

        if (!updated) {
          return `Todo not found: #${entry.input.id}`;
        }

        return `Todo updated.\n${formatTodoDetail(updated)}`;
      }

      case 'delete': {
        const todo = getTodo(db, entry.input.id);
        const label = todo ? `"${todo.todo}"` : `#${entry.input.id}`;

        if (!deleteTodo(db, entry.input.id)) {
          return `Todo not found: #${entry.input.id}`;
        }

        return `Todo ${label} (id: #${entry.input.id}) deleted (and all descendants).`;
      }
    }
  }

  // --- revise ---
  if (sub === 'revise') {
    if (!runAgent) {
      return `!${alias} revise requires an agent backend. Set backend (e.g. !backend opencode-sdk) and try again.`;
    }

    if (draftIdInvalid) {
      return `Usage: !${alias} revise <draft_id> <corrections> (draft_id must be a number)`;
    }

    const corrections = rest.slice(1).join(' ').trim();

    if (!corrections) {
      return `Usage: !${alias} revise <draft_id> <corrections>`;
    }

    const entry = getDraft(db, draftId);

    if (!entry) {
      return `Draft not found: #${draftId}`;
    }

    if (entry.kind !== 'create') {
      return `Draft #${draftId} is a ${entry.kind} draft. Use !${alias} decline ${draftId} and create a new one with the correction applied.`;
    }

    const allTodos = listTodos(db);

    const activeTodos = allTodos.filter(
      (t) => t.status !== 'done' && t.status !== 'cancelled',
    );

    const activeTree =
      activeTodos.length > 0
        ? formatTodoTree(activeTodos, false)
        : '(no active todos)';

    const revisedPrompt = `Revise the following todo: "${entry.input.todo}". Correction: "${corrections}".`;
    const systemPrompt = buildSystemPrompt(revisedPrompt, activeTree);

    const raw = getOutputString(await runAgent(systemPrompt));

    if (!raw || raw === '(no output)') {
      return 'AI returned no output. Try running: !todo-ai <revised description>';
    }

    const results = parseTodoToolCalls(raw);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');

    if (fulfilled.length !== 1) {
      const firstRejected = results.find((r) => r.status === 'rejected');

      const msg =
        firstRejected?.status === 'rejected'
          ? firstRejected.reason.message
          : 'Expected exactly one tool call';

      return `Failed to parse AI response: ${msg}. Try running: !todo-ai <revised description>`;
    }

    const call = fulfilled[0].value;

    if (call.type !== 'create') {
      return `AI did not return a create command. Try running: !todo-ai <revised description>`;
    }

    const newDraftId = storeDraft(db, {
      kind: 'create',
      input: call.input,
      originalPrompt: `${entry.originalPrompt} (revised: ${corrections})`,
    });

    deleteDraft(db, draftId);

    const cmd = `!${alias}`;

    return [
      `Draft #${draftId} revised. Created new draft #${newDraftId}:`,
      '',
      formatDraftPreview(newDraftId, call.input, cmd),
      '',
      `To accept the revised draft: ${cmd} accept ${newDraftId}`,
      `To decline the revised draft: ${cmd} decline ${newDraftId}`,
    ].join('\n');
  }

  // --- decline ---
  if (sub === 'decline') {
    if (draftIdInvalid) {
      return 'Usage: !todo decline <draft_id> (draft_id must be a number)';
    }

    if (!getDraft(db, draftId)) {
      return `Draft not found: ${draftId}`;
    }

    deleteDraft(db, draftId);

    return `Draft ${draftId} discarded.`;
  }

  return `Unknown subcommand: ${sub}. Use !todo help.`;
}

export { formatDraftPreview };

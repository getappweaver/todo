import type { Database } from 'bun:sqlite';

import type { PromptFn } from '@src/core/plugin';
import type { MessageSource } from '@src/messaging';
import { PROMPT_SESSION_EXIT } from '@src/prompt-session';
import type { WebNodeRoot } from '@src/web/ui-schema';

import { getTodoPathFromScopeToLeaf } from '../../db/todos';

import {
  alreadyResolved,
  collectLeavesInDFSOrder,
  countActiveSiblings,
  firstPendingLeafAfterFirst,
  getNextPair,
  getParentId,
  getRankedSiblings,
  recordComparison,
  resetComparisons,
  wouldContradict,
  formatWinRate,
} from './db';
import {
  createDuelTextPrompt,
  formatLeafWithAncestorPath,
} from './renderers/text';
import { createDuelPrompt } from './renderers/web';
import type {
  DuelPromptOption,
  RankedTodo,
  SendReplyFn,
} from './representation';
import { handleDuelWebAction } from './web';

function promptPayload(params: {
  source: MessageSource;
  text: string;
  options?: DuelPromptOption[];
}) {
  if (
    params.source !== 'web' ||
    !params.options ||
    params.options.length === 0
  ) {
    return createDuelTextPrompt(params.text);
  }

  return createDuelPrompt({
    source: params.source,
    command: 'todo',
    subcommand: 'duel',
    text: params.text,
    options: params.options,
  });
}

export async function startDuelSession(props: {
  db: Database;
  parentId: number | null;
  source: MessageSource;
  sendReply: SendReplyFn;
  promptFn: PromptFn;
}): Promise<void> {
  const { db, parentId, source, sendReply, promptFn } = props;
  const siblings = getRankedSiblings(db, parentId);

  if (siblings.length < 2) {
    return;
  }

  while (true) {
    const pair = getNextPair(db, parentId);

    if (!pair) {
      const ranked = getRankedSiblings(db, parentId);

      const answer = await promptFn(
        promptPayload({
          source,
          text:
            `✓ All items scored!\n\n` +
            ranked
              .map(
                (todo, index) =>
                  `${index + 1}. ${todo.todo} (${formatWinRate(todo)})`,
              )
              .join('\n') +
            `\n\nContinue with a re-duel? (yes/no)`,
          options: [
            { label: 'Yes', value: 'yes', tone: 'success' },
            { label: 'No', value: 'no', tone: 'muted' },
          ],
        }),
      );

      if (answer === PROMPT_SESSION_EXIT) {
        await sendReply('Duel ended.');

        return;
      }

      if (answer.toLowerCase().startsWith('y')) {
        resetComparisons(db, parentId);
        await startDuelSession({ db, parentId, source, sendReply, promptFn });
      }

      return;
    }

    if (alreadyResolved(db, pair.aId, pair.bId)) {
      const [winnerId, loserId] = wouldContradict(db, pair.bId, pair.aId)
        ? [pair.aId, pair.bId]
        : [pair.bId, pair.aId];

      recordComparison(db, winnerId, loserId);
      continue;
    }

    const answerRaw = await promptFn(
      promptPayload({
        source,
        text: `Which is more important?\nA) ${pair.aTitle}\nB) ${pair.bTitle}`,
        options: [
          { label: 'A', value: 'A' },
          { label: 'B', value: 'B' },
          { label: 'Skip', value: 'S', tone: 'muted' },
          { label: 'Quit', value: 'Q', tone: 'danger' },
        ],
      }),
    );

    if (answerRaw === PROMPT_SESSION_EXIT) {
      await sendReply('Duel ended.');

      return;
    }

    const answer = answerRaw.toUpperCase();

    if (answer === 'Q') {
      await sendReply('Duel stopped.');

      return;
    }

    if (answer === 'S') {
      continue;
    }

    if (answer !== 'A' && answer !== 'B') {
      continue;
    }

    const [winnerId, loserId] =
      answer === 'A' ? [pair.aId, pair.bId] : [pair.bId, pair.aId];

    const winnerTitle = answer === 'A' ? pair.aTitle : pair.bTitle;
    const loserTitle = answer === 'A' ? pair.bTitle : pair.aTitle;

    if (wouldContradict(db, loserId, winnerId)) {
      await sendReply(
        `⚠ Contradiction — "${loserTitle}" already ranks above "${winnerTitle}" transitively. Skipping.`,
      );

      continue;
    }

    recordComparison(db, winnerId, loserId);
  }
}

export async function maybeOfferDuelAfterAdd(props: {
  db: Database;
  parentId: number | null;
  newId: number;
  newTitle: string;
  source: MessageSource;
  sendReply: SendReplyFn;
  promptFn: PromptFn;
}): Promise<string | null> {
  const { db, parentId, newId, newTitle, source, sendReply, promptFn } = props;

  const siblings = getRankedSiblings(db, parentId).filter(
    (row) => row.id !== newId,
  );

  if (siblings.length === 0) {
    return null;
  }

  const answer = await promptFn(
    promptPayload({
      source,
      text: `"${newTitle}" added among ${siblings.length} sibling(s). Want to duel? (yes/no)`,
      options: [
        { label: 'Yes', value: 'yes', tone: 'success' },
        { label: 'No', value: 'no', tone: 'muted' },
      ],
    }),
  );

  if (answer === PROMPT_SESSION_EXIT) {
    return 'Duel cancelled.';
  }

  if (answer.toLowerCase().startsWith('y')) {
    await startDuelSession({ db, parentId, source, sendReply, promptFn });

    return 'Duel session finished.';
  }

  return null;
}

async function maybePromptDuelForUnscored(props: {
  db: Database;
  parentId: number | null;
  source: MessageSource;
  sendReply: SendReplyFn;
  promptFn: PromptFn;
  unscored: RankedTodo[];
}): Promise<string | null> {
  const { db, parentId, source, sendReply, promptFn, unscored } = props;

  if (unscored.length === 0) {
    return null;
  }

  const answer = await promptFn(
    promptPayload({
      source,
      text: `⚠ ${unscored.length} item(s) have no comparisons yet.\nScore them now for better results? (yes/no)\n(If skipped, unscored items are treated as lowest priority.)`,
      options: [
        { label: 'Yes', value: 'yes', tone: 'success' },
        { label: 'No', value: 'no', tone: 'muted' },
      ],
    }),
  );

  if (answer === PROMPT_SESSION_EXIT) {
    return 'Cancelled.';
  }

  if (answer.toLowerCase().startsWith('y')) {
    await startDuelSession({ db, parentId, source, sendReply, promptFn });

    return 'Duel session finished.';
  }

  return null;
}

export async function handleDuelCommand(props: {
  args: string[];
  webArgs: string[];
  db: Database;
  alias: string;
  source: MessageSource;
  sendReply: SendReplyFn;
  promptFn: PromptFn;
}): Promise<string | WebNodeRoot> {
  const { args, webArgs, db, alias, source, sendReply, promptFn } = props;
  const reset = args.includes('--reset');
  const cleanArgs = args.filter((arg) => arg !== '--reset');
  const parentId = getParentId(cleanArgs, db);

  if (webArgs.length > 0 && (source !== 'web' || webArgs[0] !== 'web')) {
    return 'Usage: todo duel [parentId] [--reset]';
  }

  if (source === 'web' && webArgs[0] === 'web') {
    return handleDuelWebAction({
      db,
      commandAlias: alias,
      parentId,
      actionArgs: webArgs.slice(1),
    });
  }

  let duelParentId = parentId;

  if (parentId !== null && !reset) {
    const parent = db
      .prepare('SELECT parent_id FROM todos WHERE id = ?')
      .get(parentId) as { parent_id: number | null } | undefined;

    if (!parent) {
      return `Todo #${parentId} not found.`;
    }

    const childCount = countActiveSiblings(db, parentId);
    const siblingParentId = parent.parent_id ?? null;
    const siblingCount = countActiveSiblings(db, siblingParentId);

    if (childCount < 2) {
      if (siblingCount < 2) {
        return 'Need at least 2 active todos at this level to duel.';
      }

      duelParentId = siblingParentId;
    } else if (siblingCount >= 2) {
      const scope = await promptFn(
        promptPayload({
          source,
          text: `Score item #${parentId} within its siblings, or score its children?\nA) within siblings  B) score children`,
          options: [
            { label: 'Within siblings', value: 'A' },
            { label: 'Score children', value: 'B' },
          ],
        }),
      );

      if (scope === PROMPT_SESSION_EXIT) {
        return 'Duel cancelled.';
      }

      if (scope.toUpperCase() === 'A') {
        duelParentId = siblingParentId;
      }
    }
  }

  if (countActiveSiblings(db, duelParentId) < 2) {
    return 'Need at least 2 active todos at this level to duel.';
  }

  if (reset) {
    resetComparisons(db, duelParentId);

    await startDuelSession({
      db,
      parentId: duelParentId,
      source,
      sendReply,
      promptFn,
    });

    return 'Duel session finished.';
  }

  if (!getNextPair(db, duelParentId)) {
    const answer = await promptFn(
      promptPayload({
        source,
        text: 'All items at this level are already scored.\nReset and re-duel? (yes/no)',
        options: [
          { label: 'Yes', value: 'yes', tone: 'success' },
          { label: 'No', value: 'no', tone: 'muted' },
        ],
      }),
    );

    if (answer === PROMPT_SESSION_EXIT) {
      return 'Duel cancelled.';
    }

    if (!answer.toLowerCase().startsWith('y')) {
      return 'OK — no reset.';
    }

    resetComparisons(db, duelParentId);

    await startDuelSession({
      db,
      parentId: duelParentId,
      source,
      sendReply,
      promptFn,
    });

    return 'Duel session finished.';
  }

  await startDuelSession({
    db,
    parentId: duelParentId,
    source,
    sendReply,
    promptFn,
  });

  return 'Duel session finished.';
}

export async function handleCurrentCommand(props: {
  args: string[];
  db: Database;
  source: MessageSource;
  sendReply: SendReplyFn;
  promptFn: PromptFn;
}): Promise<string> {
  const { args, db, source, sendReply, promptFn } = props;
  const parentId = getParentId(args, db);
  const ranked = getRankedSiblings(db, parentId);

  const duelEarly = await maybePromptDuelForUnscored({
    db,
    parentId,
    source,
    sendReply,
    promptFn,
    unscored: ranked.filter((todo) => todo.win_rate === null),
  });

  if (duelEarly !== null) {
    return duelEarly;
  }

  const leaves = collectLeavesInDFSOrder(db, ranked);

  if (leaves.length === 0) {
    return ranked.length === 0
      ? 'No pending items.'
      : 'No leaf items at this scope — every open item still has open subtasks.';
  }

  const current = leaves[0];
  const path = getTodoPathFromScopeToLeaf(db, current.id, parentId);

  return `Current:\n${formatLeafWithAncestorPath(path, current)}`;
}

export async function handleNextCommand(props: {
  args: string[];
  db: Database;
  source: MessageSource;
  sendReply: SendReplyFn;
  promptFn: PromptFn;
}): Promise<string> {
  const { args, db, source, sendReply, promptFn } = props;
  const parentId = getParentId(args, db);
  const ranked = getRankedSiblings(db, parentId);

  const duelEarly = await maybePromptDuelForUnscored({
    db,
    parentId,
    source,
    sendReply,
    promptFn,
    unscored: ranked.filter((todo) => todo.win_rate === null),
  });

  if (duelEarly !== null) {
    return duelEarly;
  }

  const leaves = collectLeavesInDFSOrder(db, ranked);

  if (leaves.length === 0) {
    return ranked.length === 0
      ? 'No pending items.'
      : 'No leaf items at this scope — every open item still has open subtasks.';
  }

  const next = firstPendingLeafAfterFirst(leaves);

  if (!next) {
    return 'No more pending leaves queued after the current one in this scope.';
  }

  const path = getTodoPathFromScopeToLeaf(db, next.id, parentId);

  return `Next:\n${formatLeafWithAncestorPath(path, next)}`;
}

import { formatTodoDetail } from '../../output/todo-detail/format';
import type { TodoCommandAdapterParams } from '../../types/adapter-params';

import { maybeOfferDuelAfterAdd } from '../duel/handler';

import { handleAddCommand } from './handler';

export async function adaptAddCommand(
  params: TodoCommandAdapterParams,
): Promise<string> {
  const result = handleAddCommand({
    prefix: params.prefix,
    alias: params.alias,
    db: params.db,
    arguments: params.parsed.arguments,
    options: params.parsed.options,
  });

  if (result.type === 'error') {
    return result.message;
  }

  const lines = [
    `Todo created: #${result.item.id}`,
    formatTodoDetail({
      id: result.item.id,
      parent_id: result.item.parentId,
      todo: result.item.text,
      status: result.item.status,
      description: result.item.description,
      tags: result.item.tags,
      created_at: result.item.createdAt,
      updated_at: result.item.updatedAt,
      completed_at: result.item.completedAt,
    }),
  ];

  const duelMsg = await maybeOfferDuelAfterAdd({
    db: params.db,
    parentId: result.item.parentId,
    newId: result.item.id,
    newTitle: result.item.text,
    source: params.source,
    sendReply: params.sendReply,
    promptFn: params.promptFn,
  });

  if (duelMsg) {
    lines.push('', duelMsg);
  }

  return lines.join('\n');
}

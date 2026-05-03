import {
  createTextPrompt,
  createWebPrompt,
  type PromptPayload,
} from '@src/core/plugin';
import type { MessageSource } from '@src/messaging';
import { draftReviewPrompt } from '@src/web/widgets';

export function createTodoDraftReviewPrompt(params: {
  source: MessageSource;
  command: string;
  subcommand: string;
  text: string;
}): PromptPayload {
  if (params.source !== 'web') {
    return createTextPrompt(params.text);
  }

  return createWebPrompt(
    draftReviewPrompt({
      command: params.command,
      subcommand: params.subcommand,
      body: params.text,
    }),
  );
}

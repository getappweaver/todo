import {
  createTextPrompt,
  createWebPrompt,
  type PromptPayload,
} from '@src/core/plugin';
import type { MessageSource } from '@src/messaging';
import { multiChoiceQuestion, type MultiChoiceOption } from '@src/web/widgets';

type DuelPromptProps = {
  source: MessageSource;
  command: string;
  subcommand: string;
  text: string;
  options?: MultiChoiceOption[];
};

export function createDuelPrompt(props: DuelPromptProps): PromptPayload {
  if (props.source !== 'web' || !props.options || props.options.length === 0) {
    return createTextPrompt(props.text);
  }

  return createWebPrompt(
    multiChoiceQuestion({
      command: props.command,
      subcommand: props.subcommand,
      question: props.text,
      options: props.options,
    }),
  );
}

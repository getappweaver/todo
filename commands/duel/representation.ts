import type { Todo } from '../../types/todos';

export type SendReplyFn = (message: string) => Promise<void>;

export type RankedTodo = Todo & {
  wins: number;
  losses: number;
  win_rate: number | null;
};

export type NextPair = {
  aId: number;
  aTitle: string;
  bId: number;
  bTitle: string;
};

export type DuelPromptOption = {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'info' | 'success' | 'warning' | 'danger';
};

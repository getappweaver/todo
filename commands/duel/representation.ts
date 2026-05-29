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

export type ChampionSource = 'manual' | 'prioritize';

export type ChampionRecord = {
  scopeKey: string;
  parentId: number | null;
  scopeHash: string;
  championId: number;
  source: ChampionSource;
  updatedAt: number;
};

export type ChampionTodo = RankedTodo & {
  championLeaf: RankedTodo;
  championPath: RankedTodo[];
};

export type ChampionScope = {
  parentId: number | null;
  scopeHash: string;
  children: ChampionTodo[];
  currentChampionId: number | null;
};

export type StaleChampionCandidate = {
  scope: ChampionScope;
  champion: ChampionTodo;
  stored: ChampionRecord;
};

export type DuelPromptOption = {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'info' | 'success' | 'warning' | 'danger';
};

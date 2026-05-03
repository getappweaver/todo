import type { AiDefinition } from '@src/system/ai-definition';

import { TodoToolCallSchema, type TodoToolCall } from './ai/schema';
import { agentInstructions, executeTool, openDb } from './ai/tooling';

export { TodoToolCallSchema, type TodoToolCall } from './ai/schema';
export { buildSystemPrompt } from './ai/prompt';
export { parseTodoToolCalls } from './ai/parse';

export const aiDefinition = {
  toolCallSchema: TodoToolCallSchema,
  skillDescription: 'Todo management via local dm-bot CLI tools.',
  openDb,
  executeTool,
  agentInstructions,
} satisfies AiDefinition<
  typeof TodoToolCallSchema,
  TodoToolCall,
  ReturnType<typeof openDb>
>;

import { z } from 'zod';

import { TodoToolCallSchema } from './schema';

export function buildSystemPrompt(
  userPrompt: string,
  activeTree: string,
): string {
  const schema = z.toJSONSchema(TodoToolCallSchema);

  return `You are managing a todo list for the user. Your output is used by the system to create draft todo items. The user will then review each draft and can accept it (create real todos), decline it, or ask for revisions. Revise applies to the whole draft (e.g. a whole tree), not a single item.

Active todos (status pending or in_progress - not done, not cancelled):
${activeTree}

User request: "${userPrompt}"

Instructions:
- Before emitting final JSON, use any available tools, skills, or workspace context needed to understand the user's request. If the request references a file path or @path (for example @docs/PLAN.md), read that file first and base the draft todos on its contents. Do not create a literal todo from the file-reading instruction itself.
- If the user asks to add items under an existing todo/list by name, resolve that target from the active todos and create/update drafts that fit that intent instead of preserving the instruction as todo text.
- If the user wants to see todos, output type "list". For "list", omit "filter" for active todos (pending + in_progress; not done or cancelled). Only include "filter" when you need a subset or mix of statuses: a JSON array like ["in_progress"], ["done"], or ["pending","in_progress","done","cancelled"] for all. For a generic "show my todos" request, omit "filter".
- If the user wants to create new todo(s), output type "create". For "create", you must output a single tree: one root node with optional "children" array. Each child has the same shape (todo, description?, tags?, children?). Use this recursive structure so parent-child relationships are expressed by nesting, not by IDs. One "create" = one tree = one draft. To add multiple unrelated top-level items, output multiple "create" objects (one JSON object per line), each with its own root and optional children.
- If the user wants to update an existing todo, output type "update". Resolve the todo by name from the active list to its numeric id and only include the fields being changed (id plus status, todo, etc. as needed).
- If the user wants to delete a todo, output type "delete".
- For "create", "update", and "delete": include "original_prompt" at the top level (same level as "type"), set to the user's request verbatim.
- Important: "update [todo name] status to X" means update the existing todo - use "update" with that todo's id, not "create".
- For name resolution (update/delete): match by name (case-insensitive, partial match). If ambiguous, pick the closest match.

Output one or more JSON objects matching this JSON Schema. One object per line (JSONL) for multiple operations. No markdown, no code fence, no explanation:

${JSON.stringify(schema, null, 2)}`;
}

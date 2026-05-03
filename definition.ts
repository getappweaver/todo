import { createHelpSubcommandDefinition } from '@src/commands/help/command';
import type { CommandDefinition } from '@src/system/command-definition';

import { acceptDefinition } from './commands/accept/definition';
import { addDefinition } from './commands/add/definition';
import { aiDefinition } from './commands/ai/definition';
import { currentDefinition } from './commands/current/definition';
import { declineDefinition } from './commands/decline/definition';
import { deleteDefinition } from './commands/delete/definition';
import { doneDefinition } from './commands/done/definition';
import { draftsDefinition } from './commands/drafts/definition';
import { duelDefinition } from './commands/duel/definition';
import { focusDefinition } from './commands/focus/definition';
import { listDefinition } from './commands/list/definition';
import { moveDefinition } from './commands/move/definition';
import { nextDefinition } from './commands/next/definition';
import { reviseDefinition } from './commands/revise/definition';
import { showDefinition } from './commands/show/definition';
import { startDefinition } from './commands/start/definition';
import { unfocusDefinition } from './commands/unfocus/definition';
import { updateDefinition } from './commands/update/definition';

export const commandDefinition = (
  prefix: string,
  alias: string,
): CommandDefinition => ({
  name: alias,
  summary: 'Todo management with nested tasks, AI drafts, and ranking.',
  aliases: [],
  subcommands: [
    createHelpSubcommandDefinition(prefix, alias, null),
    aiDefinition(prefix, alias),
    addDefinition(prefix, alias),
    draftsDefinition(prefix, alias),
    acceptDefinition(prefix, alias),
    reviseDefinition(prefix, alias),
    declineDefinition(prefix, alias),
    duelDefinition(prefix, alias),
    focusDefinition(prefix, alias),
    unfocusDefinition(prefix, alias),
    currentDefinition(prefix, alias),
    nextDefinition(prefix, alias),
    listDefinition(prefix, alias),
    moveDefinition(prefix, alias),
    doneDefinition(prefix, alias),
    deleteDefinition(prefix, alias),
    showDefinition(prefix, alias),
    startDefinition(prefix, alias),
    updateDefinition(prefix, alias),
  ],
});

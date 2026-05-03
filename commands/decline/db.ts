import type { Database } from 'bun:sqlite';

import { deleteDraft, getDraft } from '../../db/drafts';

export function getTodoDraft(db: Database, id: number) {
  return getDraft(db, id);
}

export function deleteTodoDraft(db: Database, id: number): boolean {
  return deleteDraft(db, id);
}

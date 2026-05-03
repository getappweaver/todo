import type { Database } from 'bun:sqlite';

export const TODO_SETTINGS_FOCUS_KEY = 'focus_id';

export function clearFocusId(db: Database): void {
  db.run(`DELETE FROM todo_settings WHERE key = ?`, [TODO_SETTINGS_FOCUS_KEY]);
}

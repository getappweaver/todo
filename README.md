# Todos plugin (todov2)

Todo list management: hierarchical todos, drafts, and AI-assisted revise.

**Command:** `!todov2` (alias for the `todo` plugin)

## Commands

| Command | Description |
|--------|-------------|
| `!todov2 ai <text>` | Ask AI to create or manage todos |
| `!todov2 add <text>` | Add a top-level todo |
| `!todov2 add <text> under <parent_id>` | Add a sub-todo under a parent |
| `!todov2 list [pending\|done\|all]` | List todos as a tree (default: pending and in progress) |
| `!todov2 list --flat` | Flat list of todos |
| `!todov2 show <id>` | Show todo detail |
| `!todov2 done <id>` | Mark todo done (cascades to children) |
| `!todov2 priority <id> <low\|medium\|high>` | Set priority |
| `!todov2 update <id> <field> <value>` | Update a field (todo, status, priority, description) |
| `!todov2 delete <id>` | Delete todo and all descendants |
| `!todov2 accept <draft_id>` | Confirm a draft and execute it |
| `!todov2 accept all` | Accept all pending drafts |
| `!todov2 revise <draft_id> <text>` | Ask AI to revise a pending create draft |
| `!todov2 decline <draft_id>` | Discard a draft |
| `!todov2 drafts [draft_id]` | List all drafts or show one in detail |
| `!todov2 help` | Show command summary |

## Drafts

Create and update operations can be stored as **drafts** so you can review before applying:

- When the bot suggests a create/update/delete (e.g. from `!todo-ai` in the core bot), you get a draft ID.
- Use `!todov2 accept <draft_id>` to apply the change, or `!todov2 decline <draft_id>` to discard.
- For **create** drafts only, `!todov2 revise <draft_id> <corrections>` sends your corrections to the AI and replaces the draft with a revised one.

## Status and list filters

- **pending** — not started
- **in_progress** — in progress
- **done** — completed (and descendants when using `done`)
- **cancelled**

`!todov2 list` with no argument shows pending and in progress. Use `!todov2 list done` or `!todov2 list all` for other views.

## Plugin data

- **Database:** Plugin uses its own SQLite DB (e.g. `src/plugins/todov2/db.sqlite`).
- **Tables:** Todos and todo drafts are stored in that DB; they are separate from any core-bot todo state.

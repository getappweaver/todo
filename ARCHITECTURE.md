# Plugin Command Architecture

This document captures the architecture that emerged while migrating `todo2` from a legacy plugin to a structured command system.

The important point is not `todo2` itself.

The point is that another plugin with a large legacy surface - for example `bm`, or any future plugin with mixed one-shot and interactive commands - should be able to use this as a migration guide.

## Final target shape

The target is:

- the plugin root is the real implementation root
- commands are organized by subcommand under `commands/`
- shared domain/db/output logic lives in top-level plugin folders like `db/`, `types/`, `output/`, or `ai/`
- the top-level adapter is small and boring
- legacy compatibility files, if temporarily needed, are thin wrappers only

The migration is complete when:

- new code does not depend on legacy implementation files
- the command system owns parsing, dispatch, representation, and rendering boundaries
- parent wrapper files can be deleted without changing behavior

## Recommended folder layout

```text
plugins/<alias>/
  adapter.ts
  definition.ts
  help.ts
  init.ts
  ARCHITECTURE.md

  ai/
    parse.ts
    prompt.ts
    schema.ts
    tooling.ts

  db/           # only for logic shared by 2+ subcommands
    drafts.ts
    open.ts
    todo-row.ts
    todos.ts

  output/       # only for output logic shared by 2+ subcommands
    draft/
      format.ts
    message/
      builder.ts
      renderers/
        cli.ts
      schema.ts
    todo-detail/
      format.ts
    todo-tree/
      format.ts

  renderers/
    cli.ts

  types/        # only for types shared by 2+ subcommands
    drafts.ts
    todos.ts

  commands/
    <subcommand>/
      adapter.ts
      definition.ts
      handler.ts
      db.ts        # optional, but only if this subcommand owns the implementation
      format.ts    # optional, but only if this subcommand owns the implementation
      types.ts     # optional, but only if this subcommand owns the implementation
      representation/  # optional
      renderers/       # optional
```

## Layer responsibilities

## 1. `definition.ts`

This is the command contract.

- define subcommands as plain typed objects/functions
- aggregate them into the top-level command definition
- do not put runtime behavior here

Definitions should be authored as source, not treated as untrusted input.

## 2. `adapter.ts`

This is the top-level router.

It should:

- normalize/cached command definitions
- parse tokenized args against the selected command definition
- dispatch to the correct subcommand adapter
- render the resulting representation

It should not:

- do domain work
- build help text manually
- contain special-case business logic for many commands

Important lesson from `todo2`:

- bare `/plugin` should intentionally route to `help`
- do not let missing subcommands fall through to `unknown command`

## 3. `commands/<name>/handler.ts`

Handlers do domain work only.

They should:

- validate already-parsed argument values as needed
- read/write plugin state
- return structured result data

They should not:

- render CLI strings
- build display formatting
- know about terminal-specific output

## 4. `commands/<name>/adapter.ts`

Subcommand adapters bridge parsed input to handler results.

They should:

- receive parsed invocation data
- call handlers or shared helpers
- map handler results into a representation shape

They should not:

- contain rendering logic
- become the main home of command behavior

## 5. `output/`

Rendering-related output concepts belong outside `commands/`.

Examples:

- generic `message` representation
- shared todo detail formatting
- shared draft formatting
- shared tree formatting

This is important because shared output is not itself a command.

## 6. `renderers/`

Renderers format representation objects into CLI strings.

- plugin-level renderer dispatch belongs in `renderers/cli.ts`
- per-representation renderers can live closer to the representation

Renderers should not be mixed into handlers.

## 7. Local first, shared second

Subcommands should own their implementation by default.

If logic is only needed by one subcommand:

- keep it in that subcommand module
- if needed, split it locally into `db.ts`, `types.ts`, or `format.ts`
- that local split should contain real implementation, not forwarding wrappers

Only move code to shared plugin folders when it is actually needed by 2+ subcommands.

This is the default rule for:

- `db/`
- `types/`
- `output/`
- `ai/`

## Local vs shared rule

Use this rule aggressively during migration.

If a thing is used by only one command, keep it local:

- `commands/<name>/db.ts`
- `commands/<name>/format.ts`
- `commands/<name>/types.ts`

If a thing is used by multiple commands, move it to a shared plugin folder:

- `db/`
- `types/`
- `output/`
- `ai/`

Examples from `todo2`:

- draft storage moved to shared `db/drafts.ts` because it is used by `ai`, `drafts`, `accept`, `revise`, `decline`
- AI prompt/parser/schema moved to shared `ai/` because both `ai` and `revise` use it
- duel logic stayed shared because `duel`, `current`, `next`, and add-follow-up all depend on it
- command-specific orchestration like the AI interactive review loop stays local to `commands/ai/`

Important anti-pattern:

- do not create thin wrapper files that just forward to shared code
- if a subcommand has `db.ts`, `types.ts`, or `format.ts`, that file should own meaningful implementation for that subcommand
- if the implementation is shared, move it to the shared folder instead of wrapping it locally

## Migration strategy for a legacy plugin

For another legacy plugin, do not try to rewrite everything at once.

Use this order.

### Step 1: introduce the new command shell

Create:

- root `definition.ts`
- root `adapter.ts`
- root `help.ts`
- plugin renderer entry point

Then migrate a few easy one-shot commands first.

This proves the boundaries before touching the hardest flows.

### Step 2: migrate commands, but keep ownership local first

When a migrated command still needs legacy logic:

- prefer moving/copying the actual implementation into the subcommand first
- do not add thin local wrappers unless they are truly temporary during an active edit
- do not let command files reach randomly into old modules

The goal is for the subcommand to own its behavior immediately, and only promote code outward if reuse becomes real.

### Step 3: invert dependencies

This is the most important migration phase.

The new architecture is not complete until:

- shared new modules stop importing legacy parent files

In `todo2`, this meant moving these into shared root modules:

- draft storage and draft types
- todo db helpers
- draft/todo formatting
- AI prompt/schema/parser
- DB open/schema setup

Useful audit question:

- which command files import `../../..`?

But that is only the first pass.

The real question is:

- which shared modules are still pointing back to legacy files?

### Step 4: move interactive flows after the one-shot commands stabilize

Interactive flows are usually the hardest part.

For `todo2`, these were:

- `duel`
- `ai` draft review

They still fit the architecture, but often need shared orchestration helpers and prompt-loop handling.

Important lesson:

- not every command is just parse -> handler -> render once
- interactive commands may still have a prompt loop while using the same shared command definitions, adapters, db modules, and output modules

### Step 5: collapse legacy files into wrappers

Once new modules own the implementation:

- convert old root files into thin re-export shims
- or delete them if nothing imports them anymore

For `todo2`, the final cleanup looked like this:

- deleted: old `duel.ts`, old `ai-session.ts`
- shimmed temporarily: old `ai.ts`, `db.ts`, `drafts.ts`, `format.ts`, `types.ts`
- then moved the final remaining behavior out of `ai.ts`

That is the point where the migration is effectively done.

Note:

- wrapper files are acceptable only at the old legacy boundary during migration cleanup
- they are not a recommended pattern inside the new command/subcommand architecture

## Interactive-flow learnings

Two patterns emerged.

### 1. Some interactive commands are recomputable

`duel` does not really need a persisted session table.

- the next step can be derived from persisted comparison rows
- the UI loop is interactive, but the state is mostly request-driven by scope

That kind of interactive command can stay centered around shared db/domain logic.

### 2. Some interactive commands need grouping

`ai` creates multiple draft rows that belong to one review flow.

The minimal working model was:

- store drafts with a required internal `session_id`
- review them interactively by `(session_id, index)`
- leave skipped drafts in place for later explicit review

Important rule:

- `session_id` is internal plumbing and should not leak into user-facing text

This same pattern is likely useful for other plugins that create grouped drafts or grouped staged actions.

## Practical wiring rules

These came directly from bugs encountered during the migration.

### 1. Default command behavior matters

If `/plugin` should show help, implement that intentionally in the top-level adapter.

Do not rely on parse failures to imply help.

### 2. File moves can silently break DB paths

When moving `openDb()` into a deeper folder:

- re-check the resolved sqlite path carefully
- do not assume the old relative path still works

This caused a real regression in `todo2`: commands started reading an empty DB because the moved opener pointed at the wrong file.

### 3. Help text becomes stale quickly during migration

If you migrate command ownership:

- update help summaries
- remove “experimental” or “legacy” wording once it is no longer true
- keep examples aligned with current parser behavior

### 4. Parent wrappers should become boring

Once migration is done, old root files should look like:

- a few re-exports
- or nothing, because they were deleted

If a root file still contains real logic, it is probably still a hidden source of truth.

Inside the new architecture, avoid recreating the same problem with command-local forwarding wrappers.

## Core system expectations

This plugin architecture assumes some reusable core contracts exist under `src/system/`.

Examples used by `todo2`:

- command definition contracts
- definition normalization
- help subcommand helpers
- CLI token parser
- render context types

A migrated plugin should use those boundaries instead of rebuilding its own parser/help stack.

## What to avoid

- no CLI string rendering in handlers
- no random imports from old plugin files once a new shared module exists
- no duplicated shared logic across multiple commands
- no thin wrapper `db.ts` / `types.ts` / `format.ts` files under subcommands
- no rebuilding raw command strings just to split them again
- no treating command definitions as runtime-validated data structures inside plugin code
- no long-term “temporary” wrappers that still hide real implementation

## Handoff guidance for the next plugin migration

If another agent is migrating a legacy plugin, use this checklist:

1. create the root command shell (`definition.ts`, `adapter.ts`, `help.ts`, renderer entry)
2. migrate a few one-shot commands first
3. audit local-vs-shared command dependencies
4. move reused pieces into shared root folders
5. eliminate all new-to-old imports
6. migrate interactive flows
7. collapse old files into wrappers
8. delete wrappers once nothing depends on them

If you follow that order, the migration stays understandable and reversible at every step.

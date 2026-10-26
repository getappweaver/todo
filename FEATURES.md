# Todo features

Todo-owned public feature inventory. Start the animation pilot with
`todo.filter-champions`; follow the [media implementation plan](docs/FEATURE_MEDIA_PLAN.md).
Implementation references below describe current behavior, not proposed behavior.

## Metadata convention

Each feature uses a level-two heading ending in a stable `{#todo.<slug>}` ID,
followed by metadata bullets and a public description. IDs do not change when
titles change. `Status` describes the product feature, not media readiness.
`Surfaces` lists supported entry surfaces; `cli` means the AppWeaver tool CLI.
`Showcase` is `none`, `app`, or `home` (home also includes app placement).
`Order` is an optional ascending editorial rank. Missing media means no media
exists yet; add relative `poster`, `animation`, or `video` references under a
`Media` bullet only after their files exist. Animation references will use the
shared player's eventual data-only recipe format.

This is the initial authoring convention, not an implemented parser contract.
Current landing generation still reads `landing.ts`; these flags do not yet
change the website. The inventory is an initial set, not an exhaustive command
reference. Showcase placement and ordering are editorial choices; subsequent
updates should preserve them unless the user requests a change.

## Organize nested tasks {#todo.nested-tasks}
- Status: stable
- Tags: tasks, hierarchy, organization
- Surfaces: web, cli, dm
- Showcase: app
- Order: 10
- Media:
  - poster: landing/assets/todo-nested-tasks-poster.png
  - video: landing/assets/todo-nested-tasks.webm

Organize work as a tree of tasks and subtasks. Add tasks under a parent, inspect
a selected subtree, or switch to a flat list when hierarchy is not needed.
For example: `/todo add draft release notes --under 12`.

Implementation: [add command](commands/add/definition.ts) and
[tree and flat list options](commands/list/definition.ts).

## Review AI-proposed changes {#todo.ai-drafts}
- Status: stable
- Tags: tasks, ai, drafts, review
- Surfaces: web, cli, dm
- Showcase: app
- Order: 20
- Media:
  - poster: landing/assets/todo-ai-drafts-poster.png
  - video: landing/assets/todo-ai-drafts.webm

Ask AI to create or manage tasks, then review its proposed changes as drafts.
Accept or decline a draft before applying it. Create drafts can also be revised
with correction text.

Implementation: [AI command](commands/ai/definition.ts),
[accept](commands/accept/definition.ts), [decline](commands/decline/definition.ts),
and [revise](commands/revise/definition.ts).

## Prioritize with duels {#todo.prioritize-duels}
- Status: stable
- Tags: tasks, prioritization, comparison
- Surfaces: web, cli, dm
- Showcase: app
- Order: 30
- Media:
  - poster: landing/assets/todo-prioritize-duels-poster.png
  - video: landing/assets/todo-prioritize-duels.webm

Choose between sibling tasks in pairwise comparisons to establish their ranking.
Start at the root or a selected parent with `/todo duel [parentId]`; use
`--reset` to reset comparisons before starting again.

Implementation: [duel command](commands/duel/definition.ts).
Background: [duel design and implementation history](docs/TODO_DUEL_IMPLEMENTATION_PLAN.md).

## Show only champions {#todo.filter-champions}
- Status: stable
- Tags: tasks, filtering, prioritization
- Surfaces: web, cli, dm
- Showcase: app
- Order: 40
- Media:
  - poster: landing/assets/todo-filter-champions-poster.png
  - video: landing/assets/todo-filter-champions.webm

Focus the list on branch champions and the priority winner. In the normal tree
view, ancestor rows are retained so winning tasks keep their branch context.
Use “Show only champions” in the web list or `/todo list --champion`.
Champions come from prioritization; this is not a manually assigned importance flag.

Implementation: [list command](commands/list/definition.ts),
[selection and ancestor retention](commands/list/handler.ts), and
[web list](commands/list/renderers/web.ts).

## Focus on a branch {#todo.focus-branch}
- Status: stable
- Tags: tasks, focus, navigation
- Surfaces: web, cli, dm
- Showcase: none
- Order: 999

Set a task as the current focus to work within its scope. Use `/todo focus <id>`
and `/todo unfocus` to return from that focus; the list also accepts an explicit
subtree root.

Implementation: [focus](commands/focus/definition.ts),
[unfocus](commands/unfocus/definition.ts), and [list](commands/list/definition.ts).

## Filter the task list {#todo.list-views}
- Status: stable
- Tags: tasks, filtering, views
- Surfaces: web, cli, dm
- Showcase: none
- Order: 999

Filter tasks by status, include descriptions, select a tree depth, or render a
flat list. Multiple `--status` options can be combined to select the statuses
needed for the current view.

Implementation: [list options](commands/list/definition.ts).

## Copy visible task structure {#todo.copy-task-structure}
- Status: stable
- Tags: tasks, clipboard, sharing
- Surfaces: web
- Showcase: none
- Order: 999

Copy a task's visible subtree as text, or copy the visible board, to reuse task
structure in another tool or AI conversation. Copying follows the visible list
rather than promising a complete export of hidden tasks.

Implementation: [clipboard actions and visible subtree formatting](commands/list/renderers/web.ts).

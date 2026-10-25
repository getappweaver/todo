# Todo Feature Media — Implementation Plan (Story -> EffectCraft Pipeline)

## Target Architecture

We use a unified **Story -> EffectCraft 60fps WebM Pipeline** that reuses AppWeaver's existing `StoryDefinition<TState>` scenarios without requiring custom DOM keyframe players or manual Chrome sanitization.

### Core Principles
1. **Single Source of Truth (`StoryDefinition<TState>`)**:
   - Stories defined in `plugins/<id>/stories.ts` (and command-specific story files) serve as the sole source of truth for both interactive in-app walkthroughs and high-fidelity showcase videos.
   - Leverages `story.showcase` and `step.showcase: { title, description, delayMs }`, plus `focus_target`, `wait_for_action`, `run_command`, and `set_state`.
2. **Focused Widget Capture (`apps/landing/scripts/story-media/capture-story.ts`)**:
   - Headless Playwright runner boots `http://127.0.0.1:5553/?story=<storyId>&capture=1` in unauthenticated demo sandbox mode at 2x DPR.
   - Walkthrough overlay chrome (`.story-walkthrough`), demo help drawers (`.widget-help-panel`), and unrelated input forms (`.todo-ai-prompt-form`) are suppressed in parent and Shadow DOM to ensure pure, content-height widget captures (`cardWidth: 901`, `cardHeight: 1012` at 2x DPR).
   - Isolates the relevant `.card` widget. Captures:
     - Full widget state before and after action (`state-1-before.png`, `state-1-after.png`)
     - Bounding box of the target relative to the card (`{ x, y, w, h }`)
     - Crisp cutout crop of the target (`state-1-crop.png`)
     - Active showcase title and description
   - Writes an internal resumable `manifest.json`.
3. **Cinematic EffectCraft Generation (`apps/landing/scripts/story-media/compile-effectcraft.ts`)**:
   - Dynamic display scaling: $K = \min(0.75, 920/\text{cardWidth}, 900/\text{cardHeight}) = 0.75$, centering a 759px high card with comfortable 160px top/bottom margins on a 1080p canvas.
   - **Spotlight Focus & Blur**: Ramps `ADBE Gaussian Blur 2` to 18 (Repeat Edge Pixels enabled) on the base card during focus steps, while positioning `state-1-crop.png` on top with a cyan vector accent border and subtle 108% zoom push.
   - **Click Feedback & Cross-Fade**: Expanding click ripple timed to the filter toggle action, cross-fading to `state-1-after.png` at 2.4s.
   - **3-Second Clean Board Payoff**: From 2.5s to 5.5s, holds the unblurred, sharp champion-filtered tree at 103% hero scale so viewers can read all branch champions in context.
   - **Typography Hierarchy**:
     - Headline: Two-line high-contrast pairing using `AvenirNext-Bold` at 60pt (Line 1: `"Cut the noise."` in white `[0.97, 0.97, 0.97]`; Line 2: `"Keep the winners."` in cyan `[0.31, 0.79, 0.79]`).
     - Body: `AvenirNext-Medium` at 25pt (`leading: 38`, `tracking: 5`, `C_DESC: [0.76, 0.79, 0.82]`), comfortable 2-line layout without text collisions.
     - Badge: `CourierNewPS-BoldMT` at 20pt, centered inside an unrounded (`roundness: 0`) sharp olive box with a clean 37px air gap above the headline.
   - **Top-Left Anchoring & Pixel Alignment**:
     - Anchors all footage layers (`lBefore`, `lAfter`, and `lCrop1`) by `[0, 0]` at `CARD_TOP_LEFT = [CARD[0] - (IMG_W * K) / 2, CARD[1] - (IMG_H * K) / 2]`, eliminating the 48px vertical misalignment bug caused by dynamic card height variations before vs. after filtering.
   - Renders 60 FPS WebM (`champions.webm`), high-res poster at 3.5s (`poster.png`), and spotlight frame at 1.8s (`spotlight.png`).
4. **Unified Command Entry Point (`apps/landing/scripts/story-media/generate.ts`)**:
   - Single command `bun apps/landing/scripts/story-media/generate.ts --story <id> [--fps 60] [--reuse-capture]` connects capture and compilation in-memory.

---

## Progress

### 1. Feature Definition & Story Authoring
- [x] Create `buildFilterChampionsStory` in `plugins/todo/commands/list/stories.ts`.
- [x] Single-action narrative focused on "Show only champions" toggle (removed redundant row-402 spotlight).
- [x] Seed realistic fictional tasks (`MARKETING`, `Publish release notes 🏆`, `ONBOARDING`, `MOBILE EXPERIENCE`).
- [x] Register in `plugins/todo/stories.ts`.
- [x] Update `plugins/todo/commands/list/renderers/web.ts` with `storyTargetId: 'todo-filter-champions'` and `storyTargetId: 'todo-list-filter-toggle'`.
- [x] Ensure branch tree expansion by default (`defaultExpandedIds`) so child tasks render cleanly during automated playback.

### 2. URL Bootstrap & Capture Mode
- [x] Support `?story=<id>` query parameter in `web/src/App.tsx` for immediate story launch upon demo runtime mount.
- [x] Support `?capture=1` mode setting `data-capture="true"` on `.app-shell`.
- [x] Suppress `.story-walkthrough`, `.widget-help-panel`, and `.todo-ai-prompt-form` in `web/src/styles.css` and `capture-story.ts`.
- [x] Regenerate offline demo bundles (`web/public/demo/stories.json`) via `bun run demo:generate`.

### 3. Pipeline Implementation (`apps/landing/scripts/story-media/`)
- [x] `types.ts`: Strict types (`StoryCaptureBeat`, `TargetRect`, `StoryCaptureManifest`) adhering to the 3+ parameter rule without optional properties.
- [x] `capture-story.ts`: Playwright headless runner extracting pure widget card PNGs, target coordinates, and cutout crops.
- [x] `compile-effectcraft.ts`: ExtendScript generator and `effectcraft-cli` runner with dynamic scale $K$, modern typography pairing, and 5.5s timeline.
- [x] `generate.ts`: Unified CLI entry point with in-memory piping and `--reuse-capture` support.
- [x] Verified pilot generation on `todo-filter-champions`:
  - 1920x1080 @ 60.0 FPS, 5.5 seconds (330 frames).
  - WebM render completed (`plugins/todo/landing/assets/todo-filter-champions.webm`, 3.0 MB).
  - High-resolution poster rendered at $t=3.5\text{s}$ (`plugins/todo/landing/assets/todo-filter-champions-poster.png`, 107 KB).
  - Spotlight frame rendered at $t=1.8\text{s}$ (`plugins/todo/landing/story-media/todo-filter-champions/spotlight.png`, 140 KB).
- [x] Resolved Argon review issues:
  1. **Spotlight Cutout Offset Bug**: Top-left `[0, 0]` anchoring on `lBefore`, `lAfter`, and `lCrop1` completely eliminated the 48px vertical offset.
  2. **Text Collision**: Increased vertical air gap to 37px between sharp `/todo` badge and headline; separated into two distinct layers (`"Cut the noise."` and `"Keep the winners."`).
  3. **Ad-Level Typography & Visual Polish**: Switched to `AvenirNext-Bold` 60pt and `AvenirNext-Medium` 25pt; replaced `👀` with `📝` on only 2 items; eliminated empty badge phantom spacing; flattened `/todo` badge roundness.
  4. **Card Shadow Height & Centering**: Implemented dual-shadow crossfade (`Card Shadow Before` $\rightarrow$ `Card Shadow After`) and `rig` vertical recentering, removing the hanging 110px shadow and symmetrically balancing the filtered card.
  5. **Plugin Locality & Portable ExtendScript**: Moved source artifacts to `plugins/todo/landing/story-media/todo-filter-champions/` with portable `DIR = new File($.fileName).parent.fsName` path resolution, eliminating machine-specific paths and cleaning root `scratch/`.
  6. **Kinetic Token Reveal & Markdown Styling**: Sub-pixel text measurement and kinetic reveal for `"Collapse noisy branches.\nSurface **branch champions** and your *#1 priority*."` with styled cyan accent pill backing.

---

## Verification & Status

- **Typecheck**: `bunx tsc --noEmit` across root, `web/`, `apps/landing/`, and `plugins/todo/` $\rightarrow$ 0 errors.
- **Linting**: `bunx eslint` on all touched/new files $\rightarrow$ 0 errors, 0 warnings.
- **Render Output**: Verified with `effectcraft-cli info` (12 layers, 307 effects, valid comp).

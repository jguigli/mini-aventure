# Step 5 — Creation screen, undo history, autosave

## Goal

An author types an idea, picks a reading level, generates a story and lands on the story screen. The built-in example opens without any API call. Every change can be undone, and a page refresh never loses work.

## What was built and how it works

### Creation screen (`screens/Create.tsx`)
- **Layout**: a centred card with a title, the "Ton idée" textarea (inspiring placeholder, `x/500` counter, `maxLength` 500) and the three reading-level pills.
- **Buttons**: « ✨ Générer l'aventure » is disabled while the idea is empty. « Charger l'exemple » parses `examples/le-phare.json` with zod and opens it with no API call. « Importer un .ink » is disabled until step 8.
- **Reading levels** (`components/ReadingLevelPicker.tsx`): `role="radiogroup"` with `role="radio"` buttons and `aria-checked`. Only the selected pill is in the Tab order (roving tabindex), and the arrow keys move **and** select. « 11-12 ans » is selected by default.
- **Generating** (`components/GeneratingStory.tsx`): three bobbing emojis, which stop with `prefers-reduced-motion`, and a message that changes every 3 s and is announced with `aria-live="polite"`. An « Annuler » button aborts the request.
- **Errors**: shown in the page (`role="alert"`) with the server's French message and a « Réessayer » button. The idea and the level are kept.
- **Notices**: a resume banner when a save exists (see below), and a warning when `/api/health` reports no OpenAI key.

### API client (`lib/api.ts`)
`requestStory()` POSTs to `/api/generate` and turns every failure into an `ApiClientError` with a French message: the server's own message, or « Impossible de joindre le serveur… » when the proxy cannot reach it. It **re-parses** the story with zod, so the client never trusts an unexpected shape. A cancelled request is not reported as an error.

### Story store and undo history (`state/storyStore.ts`)
- **The single source of truth** for the app. `App.tsx` shows the creation screen when there is no story, and the story screen otherwise.
- **History** = snapshots of the whole `Story`, as `past / present / future`. Stories are a few KB, so copies are simpler and safer than recording each operation.
- **Pure functions** (`loadStory`, `applyEdit`, `undo`, `redo`), unit-tested. A tiny observable store wraps them (`createStoryStore`), and React reads it with `useSyncExternalStore`. No state library is needed.
- **Merging keystrokes**: `edit(update, { coalesceKey })`. Successive edits with the same key, less than 1 s apart, become **one** undo step. A pause, or another field, starts a new step. Discrete actions (step 6) pass no key.
- **Limits**: 50 undo steps. A new edit clears the redo branch. Loading a story starts a fresh history.

### Keyboard shortcuts (`state/useUndoShortcuts.ts`)
Ctrl/Cmd+Z undoes, and Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. **When the focus is in an `input`, `textarea`, `select` or contenteditable element, the app does nothing** and the browser's own undo for that field applies.

### Autosave (`state/autosave.ts`)
- The current story is saved about **500 ms after the last change** (debounced) under `mini-aventure:v1`, as `{ story, savedAt }`. The undo history is not saved.
- A pending save is **flushed on `pagehide`**, so a refresh right after typing loses nothing.
- Every read and write is in **try/catch**, and a saved story is validated with `Story.safeParse`. Corrupted data or an unavailable storage never crashes the app.
- **Indicator** (`components/SavedIndicator.tsx`): « ✓ Enregistré » in the bottom bar, or « Sauvegarde impossible » if the write failed.
- **Resume**: at startup, if a save exists, the creation screen shows « Reprendre ton aventure : *titre* » with « Reprendre » and « Nouvelle histoire » (which deletes the save). « ← Accueil » from the story screen keeps the save and shows the banner.

### Temporary story screen (`screens/Editor.tsx`)
It has the final header (« ← Accueil », editable title, ↶ / ↷ buttons) and the final bottom bar (saved indicator). The middle is a simple scene list (emoji, title, mood colour, text, choices and their targets), which step 6 replaces with the map and the side panel.

### Step 4 follow-up (generation reliability)
The first real generation from the UI failed with a 422 after two attempts: ending B again had no choice leading to it. Changes:
- **Prompt**: `plan.endingA` / `plan.endingB` must name the ending's scene id and the choice that leads to it **before** the scenes are written.
- **`validateStory` message**: it is now actionable, both in the editor and in the retry: « …fais pointer au moins un choix d'une scène atteignable vers « x » ».

- **Reasoning effort `low`**: the next failure was a choice to a non-existent scene that the retry did not fix. The model was answering with no reasoning, so it now gets a small reasoning budget to check its graph (`server/src/openai.ts`).

- **The retry lists the scenes that exist**: every scene of the model's answer is given as "the only possible values for `targetSceneId`", with an explicit instruction when a target is missing. To support this, every `ValidationIssue` now has a machine-readable `code`.

The code still never rewires a choice on its own.

Measured with 4 real calls (authorised, about 4 cents):

| # | Idea (level) | Reasoning | Result |
|---|---|---|---|
| 1 | Chat astronaute (8-10) | default | ✅ first try, 5.1 s |
| 2 | Bibliothèque qui change (11-12) | default | ❌ 422: choice to a non-existent scene |
| 3 | Dénoncer ou protéger (13-15) | default | ✅ first try, 9.1 s |
| 4 | Bibliothèque qui change (11-12) | `low` | ✅ first try, 9.4 s |

The three valid stories have 0 validation issues, compile, and reach 100% of their scenes and both endings, with no dead end.

## Files

Created:
- `client/src/screens/Create.tsx`, `client/src/screens/Editor.tsx`
- `client/src/components/ReadingLevelPicker.tsx`, `client/src/components/GeneratingStory.tsx`, `client/src/components/SavedIndicator.tsx`
- `client/src/state/storyStore.ts`, `client/src/state/autosave.ts`, `client/src/state/useUndoShortcuts.ts`, `client/src/state/state.test.ts`
- `client/src/lib/api.ts`
- `docs/steps/05-create-screen.md`

Modified:
- `client/src/App.tsx` (screens, autosave, shortcuts, health), `client/src/styles.css` (all screens)
- `shared/validate.ts`, `shared/validate.test.ts` (actionable reachability messages, issue `code`)
- `server/src/generate.ts`, `server/src/generate.test.ts` (the retry receives the list of existing scenes)
- `server/src/prompts.ts` (plan names the ending scenes), `server/src/openai.ts` (reasoning effort `low`, reasoning tokens logged)
- `docs/03-deviations.md` (section "Step 5"), `README.md` ("Using the app")

## Decisions and deviations from docs/02

See [`docs/03-deviations.md`](../03-deviations.md), section "Step 5". In short:
- a temporary story screen;
- undo merging keyed by field, plus Ctrl+Y and undo/redo buttons;
- the `{ story, savedAt }` save file, with a `pagehide` flush;
- « ← Accueil » keeps the save;
- a cancel button and a missing-key notice;
- the generation reliability follow-up.

## Library docs checked

- **React 19**: `useSyncExternalStore(subscribe, getSnapshot)` for the external store. `getSnapshot` returns the same object until a change, which avoids extra renders.
- **Playwright** (`playwright-core`, installed in the scratchpad only, not in the project) drives the installed Google Chrome with `channel: "chrome"`. `page.route()` intercepts `/api/generate` for the free UI tests.

## How to test

```bash
make test       # 118 tests
make dev        # http://localhost:5173
```

Acceptance:
- [x] **Idea → generated story → next screen.** Tested in a real browser with `/api/generate` intercepted, so no cost: request body `{"idea":"Un chat astronaute cherche la Lune","readingLevel":"8-10"}` (idea trimmed); loading messages appear; on a 422 the error is shown and the idea is kept; « Réessayer » → story screen. A **real** generation was also run from the UI: it reached the server, failed with a 422 after the retry, and the error was shown correctly. That failure led to the step 4 follow-up above.
- [x] **The example opens without an API call**: 7 scenes, title « Le phare qui murmure ».
- [x] **After a refresh, the story can be resumed with its changes.** Title edited to « Le phare qui chante » → « ✓ Enregistré » → `localStorage` holds the new title → reload → banner « Reprendre ton aventure : Le phare qui chante » → « Reprendre » → title kept, and undo disabled (fresh history).

Also checked in the browser:
- [x] Default level « 11-12 ans ». ArrowRight selects « 13-15 ans » and moves the focus.
- [x] Typing a whole title, then Ctrl+Z outside the field, restores the original title **in one step**. Ctrl+Shift+Z redoes it.
- [x] « ← Accueil » shows the resume banner. « Nouvelle histoire » removes the banner and the `localStorage` key.
- [x] A corrupted save (`{oops`) is ignored, with no banner and no crash.
- [x] « Annuler » during generation brings the form back, with no error shown.
- [x] No JavaScript errors in the console.

Unit tests (`client/src/state/state.test.ts`):
- [x] Undo/redo.
- [x] Keystroke merging (same field), new step after a pause or in another field.
- [x] The redo branch is cleared by a new edit, and the 50-step limit holds.
- [x] Store notifications.
- [x] Save and read back under the versioned key.
- [x] Corrupted JSON, invalid story, throwing or missing storage: never throws.
- [x] Debounced autosave writes once per burst, never on clear, stops cleanly, and reports a failure.
- [x] Shortcut mapping, and text fields are left to the browser.

## Known limitations

- **Generation reliability was measured on a small sample only** (4 calls, table above). A generation can still end with a 422, which is shown cleanly with « Réessayer ».
- Some emojis are still repeated within a story (1 to 2 per story). The prompt asks for no repeats, but it is not enforced, because it is cosmetic.
- The story screen is temporary: the map, the side panel and the reader come in steps 6 and 7.
- Undo merging uses a 1 s window: two quick edits in the same field, separated by a click elsewhere, can merge. This is harmless.

## Git

```bash
git add client/src/App.tsx client/src/styles.css \
  client/src/screens/Create.tsx client/src/screens/Editor.tsx \
  client/src/components/ReadingLevelPicker.tsx client/src/components/GeneratingStory.tsx \
  client/src/components/SavedIndicator.tsx \
  client/src/state/storyStore.ts client/src/state/autosave.ts client/src/state/useUndoShortcuts.ts \
  client/src/state/state.test.ts client/src/lib/api.ts \
  shared/validate.ts shared/validate.test.ts server/src/prompts.ts server/src/openai.ts \
  server/src/generate.ts server/src/generate.test.ts \
  docs/03-deviations.md docs/steps/05-create-screen.md README.md
git commit -m "feat(ui): add creation screen, undo history and browser autosave"
```

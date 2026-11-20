# Step 8 — Import and export

## Goal

Complete the export (compiled `.json`, view and copy the code), open any `.ink` file in a text mode where it is checked, played and editable, and ship a public `.ink` example with its source and license.

## What was built and how it works

### Export bar (`components/ExportBar.tsx`), shared by Édition, Lecture and the import screen
- **« ⬇ Exporter le .ink »** stays the main button. It produces the source an author can reopen in Inky.
- **« Autres formats ▾ »** is a native `<details>` menu with:
  - **« Exporter le .json compilé »**: compiles the current Ink with inkjs and downloads `story.ToJson()`, which is what ink runtimes load (inkjs, the Unity plugin…). If the story does not compile, an inline message explains why;
  - **« Voir le code Ink »**: a native `<dialog>` (focus trap, Escape) with the code and a **Copier** button (`navigator.clipboard`, « ✓ Copié »).
- Files are named after the title (`fileBaseName`: `le-phare-qui-murmure.ink` / `.json`) and are always produced from the **current** source at click time (`getInk()`).

### Import (`screens/Create.tsx`, `screens/ImportScreen.tsx`)
- **« Importer un .ink »** on the home screen opens a file picker (`.ink`). Empty files and files over 1 MB are refused with a message.
- **« Exemple Ink d'inkle »** opens the public example directly (bundled with Vite's `?raw`).
- **Text mode** (no map, an assumed choice):
  - **Left**: the code in a monospace editor. Changes are recompiled and re-explored ~400 ms after the last keystroke. Below it, the **verification**: compile errors, or knots reached x/y, endings reached, unreached knots, dead ends, runtime errors, truncation. A note says that exploration is approximate with variables or conditions.
  - **Right**: the **player** (the same component as Lecture) with « Fins découvertes : x/N », where N is the number of endings found by the explorer.
  - **Bottom**: the export bar (`.ink` and compiled `.json` of the edited text).
- The imported file lives in its **own state**: it is not autosaved (`mini-aventure:v1` holds only our JSON stories) and has no app undo history (the textarea has the browser's own). Leaving with unsaved changes asks for confirmation.
- The explorer and the player use **two separate compiled instances**, because the explorer resets the state of the story it plays.

### Player for any Ink (`components/InkPlayer.tsx`, `lib/player.ts`)
- The player card was extracted from the Reader. `Reader.tsx` now compiles the JSON story and hands it to `InkPlayer`. The import screen uses the same component.
- For an imported `.ink` without our tags, `player.ts` (given the list of knots) counts any place where the story stops as an ending, named after its knot. This is the same rule as the explorer. It is shown as « Fin de l'histoire ».
- Focus only follows the reader's own actions (a choice, « Rejouer »), never a recompilation, so typing in the code editor is never interrupted.

### Explorer depth guard (`lib/explorer.ts`)
The search is recursive. With a story that has many distinct states, it could overflow the call stack and crash the page: this happened while testing an imported story with variables. It now stops at **`MAX_DEPTH = 1000`** choices in a row and reports `truncated`.

### Public example (`examples/monsieur-fogg.ink`)
« A conversation with nested nodes », from inkle's official *Writing with ink*, copied verbatim. A header comment gives the source URL (pinned commit) and the license (MIT, "Copyright (c) 2025 inkle Ltd."), and the README lists it. It uses weave syntax (nested choices and gathers, no knots), which our app never generates, so it is a real test of the text mode. Other candidates were rejected (see deviations).

## Files

Created:
- `client/src/components/ExportBar.tsx`, `client/src/components/InkPlayer.tsx`
- `client/src/screens/ImportScreen.tsx`
- `client/src/lib/import.test.ts`
- `examples/monsieur-fogg.ink`
- `docs/steps/08-import-export.md`

Modified:
- `client/src/lib/player.ts` (endings in imported Ink), `client/src/lib/explorer.ts` (depth guard, `knotOf` exported)
- `client/src/lib/download.ts` (`fileBaseName`, `downloadText`), `client/src/lib/editor.test.ts`
- `client/src/screens/Reader.tsx` (now a thin wrapper around `InkPlayer`), `client/src/screens/Editor.tsx` (uses `ExportBar`), `client/src/screens/Create.tsx` (import, inkle example), `client/src/App.tsx` (import state)
- `client/src/styles.css` (export menu, code dialog, import screen)
- `docs/03-deviations.md` (section "Step 8"), `README.md` (usage, examples and sources)

## Decisions and deviations from docs/02

See [`docs/03-deviations.md`](../03-deviations.md), section "Step 8":
- the choice of public example, and the rejected candidates (LD41 Emoji: content not suitable for children, and it showed the explorer's limit; The Intercept: no license; back_in_london: runtime error);
- the variable-aware explorer tried and reverted, and the depth guard added;
- endings recognised in imported Ink;
- one shared player component;
- native `<details>` / `<dialog>` for the menu and the code viewer;
- import limits.

## Library docs checked

- **inkjs 2.4**: `Story.ToJson()` returns the compiled JSON (`inkVersion: 21`, `root`). `VariablesState.$(name)` reads a variable (used in the reverted prototype).
- **Vite**: `import text from "file.ink?raw"` bundles a file as a string, typed by `vite/client`.
- **Licenses checked directly**:
  - `inkle/ink`: MIT (GitHub API and `LICENSE.txt` at the pinned commit, "Copyright (c) 2025 inkle Ltd.").
  - `inkle/ink-library`: MIT, and its README says contributed samples become MIT.
  - `inkle/the-intercept`: no license declared.

## How to test

```bash
make test       # 146 tests
make dev        # http://localhost:5173
```

Acceptance (checked in Chrome driven by Playwright):
- [x] **Export then re-import of the built-in example, with no error.** « Charger l'exemple » → « ⬇ Exporter le .ink » (2,573 chars) → « ← Accueil » → « Importer un .ink » with that file. The text mode shows « Le phare qui murmure », « Knots atteints : 7/7 », « Fins atteintes : 2 ». It plays to « Fin A : La voix libérée », « Fins découvertes : 1/2 ».
- [x] **The public example imports, plays, and the explorer shows its results.** « Exemple Ink d'inkle » → « Fins atteintes : 1 ». First passage « I looked at Monsieur Fogg ». « … but I said nothing » → « … but I said nothing and we passed the day in silence. » → « Fin de l'histoire », « Fins découvertes : 1/1 ».

Also checked in the browser:
- [x] « Exporter le .json compilé » downloads `le-phare-qui-murmure.json`, valid JSON with `inkVersion: 21` and `root`.
- [x] « Voir le code Ink » opens the dialog with the code. « Copier » puts it in the clipboard (« ✓ Copié »). Escape closes it.
- [x] Editing the imported text: breaking a divert shows `ERROR: line 4: Divert target not found: '-> nulle_part'` and « L'histoire ne compile pas » in the player. Fixing it brings back « Knots atteints : 7/7 ».
- [x] The step 6 and 7 browser scenarios still pass (map, undo, export, Reader, both endings, mode switching).
- [x] No JavaScript errors in the console.

Unit tests (`client/src/lib/import.test.ts`):
- [x] Our export re-compiles, `knotNamesFromSource` finds the same scene ids, and exploration is at 100%.
- [x] The compiled JSON has `inkVersion`.
- [x] The public example keeps its source and license header. It compiles, has no knots, 1 ending, no dead end, and is not truncated. It replays the documentation's short playthrough, and the ending is counted.
- [x] A 1,050-knot chain stops with `truncated` instead of overflowing the stack.

## Known limitations

- **Exploring imported Ink with state is approximate**:
  - variables and read counts are not part of the decision key, so a branch that only opens under a condition can be missed;
  - on a story like LD41 Emoji, 0 endings are found.

  The screen says so. A faithful explorer for arbitrary Ink is a project of its own.
- Text mode only for imported files: there is no map, and an imported file cannot be turned back into our JSON format.
- « Fins découvertes » on the import screen is kept per file, while the screen is open.

## Git

```bash
git add client/src/components/ExportBar.tsx client/src/components/InkPlayer.tsx \
  client/src/screens/ImportScreen.tsx client/src/screens/Reader.tsx client/src/screens/Editor.tsx \
  client/src/screens/Create.tsx client/src/App.tsx client/src/styles.css \
  client/src/lib/player.ts client/src/lib/explorer.ts client/src/lib/download.ts \
  client/src/lib/editor.test.ts client/src/lib/import.test.ts \
  examples/monsieur-fogg.ink docs/03-deviations.md docs/steps/08-import-export.md README.md
git commit -m "feat(io): import .ink in text mode, export compiled JSON and view code, add inkle example"
```

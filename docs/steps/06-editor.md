# Step 6 — Map editor

## Goal

Edit the story on a visual map with a side panel, see every problem live (without being blocked), test paths quickly, undo anything, and export the `.ink` at any time. Also: implement "option 2", so that when the AI leaves a fixable problem, the story still opens with warnings instead of failing.

## What was built and how it works

### Data flow
```
storyStore (JSON, source of truth)
   │  every edit: storyStore.edit(update, { coalesceKey }) → undo history + autosave
   ▼
useStoryAnalysis (≈300 ms after the last change)
   └─ analyzeStory: validateStory → storyToInk → compileInk → explore
   ▼
StoryMap (colours, ⚠️, greyed scenes) · VerificationPanel · « ✅/⚠️ Vérifier »
```

### Map (`components/StoryMap.tsx`, `lib/layout.ts`)
- **React Flow 13**, with one custom node per scene: emoji, title, and tags (Départ, Fin A/B, Inaccessible, ⚠️ count or Impasse).
- **Colours**: the mood sets the background of narrative scenes. Ending A is green, ending B is purple. **Unreachable scenes are greyed and dashed.**
- **Arrows**: one per choice, labelled with the choice's emoji. A choice with a missing target has no arrow, and its scene shows ⚠️.
- **Layout** (`computeLayout`, a pure function): the column is the breadth-first depth from the start. Endings always sit in the last column (A above B, even when unreachable), and unreachable narrative scenes go to a separate column. Rows follow discovery order, and each column is centred.
- Nodes are not draggable (out of scope). The map re-frames itself when its structure changes (a scene added or removed, or moved to another column), but not on every keystroke.

### Side panel (`components/ScenePanel.tsx`, `lib/storyEdits.ts`)
- **Fields**: title, emoji, mood (select), text (a textarea that grows with its content), the ending label for endings, and the issues of this scene.
- **Choices**: label, emoji, and a « Mène à » select listing the other scenes. A missing target shows « ⚠️ … (introuvable) » and highlights the choice. Each choice has 🗑️ to delete it, and « + Ajouter un choix » adds one with no target yet, flagged until the author picks one.
- **« + Nouvelle scène »** creates an unconnected scene with an id derived from its title (`uniqueSceneId`: ASCII, no Ink reserved word, `_2` suffix if taken) and selects it. **Ids are never edited**, so renaming a scene cannot break its incoming choices.
- **« Supprimer la scène »** asks for confirmation (the message says how many scenes lead to it) and is disabled for the start scene. Incoming choices are **kept**, flagged « destination manquante ». Ctrl+Z brings the scene back.
- **« ▶ Jouer depuis ici »** is shown but disabled until step 7.
- **Undo**: every operation is a pure function in `storyEdits.ts` (a new story every time, never a mutation), applied with `storyStore.edit`. Text fields pass a `coalesceKey`, so a typed sentence is one undo step. Discrete actions (a target change, an added or removed choice or scene) are one step each.

### Live checks (`lib/analysis.ts`, `state/useStoryAnalysis.ts`, `components/VerificationPanel.tsx`)
- `analyzeStory(story)` gives, in one pure call:
  - the `validateStory` issues, grouped by scene;
  - the Ink;
  - compile errors and warnings;
  - the explorer result;
  - unreachable scenes and dead ends;
  - endings reached and total;
  - an overall `ok`.
- It runs ≈300 ms after the last change. The first run is synchronous, so the map never renders without statuses.
- **« Vérifier »** runs the checks immediately and shows the report. It has two sections on purpose: « Parcours joué par inkjs » (scenes reached x/y, endings x/2, never reached, stops without an ending, runtime errors) and « Structure » (`validateStory`). Every scene name in it opens that scene.
- Problems **warn, they never block**: an invalid story still compiles (missing targets become `-> END`), and the map and the export keep working.

### Quick test (`components/QuickTest.tsx`)
A bar under the map shows the current scene and its choices as buttons. Each click moves on: the current scene glows on the map, visited scenes and taken arrows light up, and choices with a missing target are disabled. « Réinitialiser » starts over. If the current scene disappears (deleted, undone), the test restarts.

### Bottom bar and export (`lib/download.ts`)
« ⬇ Exporter le .ink » downloads `<title-slug>.ink`, serialized from the **current** JSON at click time, plus the « ✓ Enregistré » indicator. The other export formats come in step 8.

### Option 2: stories with fixable issues still open
- Every `ValidationIssue` has a `code`.
- `FIXABLE_IN_EDITOR` (an allowlist, in `server/src/generate.ts`) lists what the editor can repair. After the retry, if every remaining issue is fixable, the server returns `{ story, warnings }` instead of a 422.
- The client opens the story with a dismissible banner, « L'IA a laissé N problème(s) qu'elle n'a pas su corriger… », and the problems are flagged on the map.

## Files

Created:
- `client/src/components/StoryMap.tsx`, `ScenePanel.tsx`, `VerificationPanel.tsx`, `QuickTest.tsx`
- `client/src/lib/layout.ts`, `storyEdits.ts`, `analysis.ts`, `download.ts`, `editor.test.ts`
- `client/src/state/useStoryAnalysis.ts`
- `docs/steps/06-editor.md`

Modified:
- `client/src/screens/Editor.tsx` (rewritten: header, map, panel, quick test, action bar, warnings banner)
- `client/src/App.tsx`, `client/src/screens/Create.tsx`, `client/src/lib/api.ts` (warnings from generation)
- `client/src/styles.css` (editor styles, replacing the temporary list)
- `client/package.json`, `package-lock.json` (`@xyflow/react`)
- `server/src/generate.ts`, `server/src/generate.test.ts`, `server/src/index.ts`, `shared/api.ts` (option 2)
- `docs/03-deviations.md` (section "Step 6"), `README.md`

## Decisions and deviations from docs/02

See [`docs/03-deviations.md`](../03-deviations.md), section "Step 6":
- **option 2** (a story with warnings instead of a 422 when everything is fixable);
- React Flow 13;
- unreachable endings stay in the endings column;
- re-framing on structure changes;
- « Impasse » only for scenes with no choices;
- the Lecture toggle and « Jouer depuis ici » present but disabled;
- the quick test follows the JSON;
- keyboard access to the map deferred to step 10.

## Library docs checked

- **`@xyflow/react@13.0.2`** (`dist/index.d.ts`): the exports `ReactFlow`, `Handle`, `Background`, `Controls`, `MarkerType`, `Position`; `Node<Data, Type>` and `NodeProps<NodeType>`; the `ReactFlowProps` fields used (`nodesDraggable`, `nodesConnectable`, `edgesFocusable`, `onNodeClick`, `onPaneClick`, `onInit`, `fitView`, `fitViewOptions`, `minZoom`, `proOptions`). The stylesheet is `@xyflow/react/dist/style.css`.
- **CSS `field-sizing: content`** makes the scene text grow with its content in recent Chromium. Other browsers fall back to a resizable textarea.

## How to test

```bash
make test       # 134 tests
make dev        # http://localhost:5173 → « Charger l'exemple »
```

Acceptance (checked in Chrome driven by Playwright, with the example story):
- [x] **I edit a text**: typed « Une étoile tombe dans l'eau. » into the crique scene.
- [x] **I redirect a choice**: « Porter le coquillage jusqu'aux vagues » now goes to « La voix perdue » (fin B).
- [x] **The map changes colour, and an ending that became unreachable is reported**: ending A turns greyed and dashed with « Inaccessible » and **stays visible on the map**. « Vérifier » turns ⚠️, and the report says « Scènes atteintes : 6/7 · Fins atteintes : 1/2 · Jamais atteinte : ☀️ La voix libérée ». The crique panel also flags the two choices that now lead to the same place.
- [x] **Ctrl+Z undoes**: the first Ctrl+Z restores the target (ending A back to normal, ✅). The second restores the text **in one step** (the whole typed sentence). Ctrl+Shift+Z redoes both.
- [x] **« Exporter le .ink » downloads a file with my change**: `le-phare-qui-murmure.ink` contains the new sentence and `[Porter le coquillage jusqu'aux vagues #emoji: 🌊] -> fin_brume`.

Also checked in the browser:
- [x] The example map has 7 nodes and 12 arrows, and shows « ✅ Tout est en ordre ».
- [x] Quick test: « Descendre à la crique » → « Porter le coquillage » → « Fin A : La voix libérée ». The current node glows, 2 arrows are lit, and « Réinitialiser » clears everything.
- [x] « + Ajouter un choix » adds a 3rd choice, highlighted as broken. « + Nouvelle scène » creates and selects « Nouvelle scène », greyed (unreachable).
- [x] Deleting « Trois éclats de lumière » shows a confirmation naming 1 incoming scene. Its incoming choice is kept and flagged (« ⚠️ 1 » on « La lueur verte »). Deleting the start scene is disabled.
- [x] **Option 2** (generation intercepted, no cost): a story with a choice to `escalier_cache` opens, with the banner « L'IA a laissé 1 problème… », the scene flagged « ⚠️ 1 », and the report naming the missing target. « Compris » hides the banner.
- [x] No JavaScript errors in the console.

Unit tests (`client/src/lib/editor.test.ts`, `server/src/generate.test.ts`):
- [x] Layout: columns, distinct positions, the unreachable column, unreachable endings kept in place, determinism.
- [x] Edits: unique and valid ids, no mutation, add and remove choices and scenes, the start scene protected, the export file name.
- [x] Analysis: the example is ok. The step 6 acceptance scenario (redirected choice → `fin_lumiere` unreachable, 1/2 endings), and a deleted scene giving `missing_target` while the Ink still compiles.
- [x] Option 2: fixable issues return warnings after the retry. Blocking issues still throw. No warnings when the retry succeeds.

## Known limitations

- Keyboard navigation **on the map itself** is not done yet: scenes are opened by mouse, or with the keyboard through the verification report. The full alternative is in step 10.
- The edit panel cannot turn a scene into an ending or back, so the number of endings is fixed by generation. That is why "ending count" issues stay blocking for option 2.
- Arrow labels (emojis) can overlap on dense maps.
- `make build` warns that the JS bundle is over 500 kB (the full inkjs compiler plus React Flow). This is acceptable for a local app. Code splitting is a possible follow-up.
- The ending B emoji (🌫️) renders as a placeholder glyph in headless Chrome screenshots only, because of a missing font in the test environment. It renders fine in a normal browser.

## Git

```bash
git add client/src/components/StoryMap.tsx client/src/components/ScenePanel.tsx \
  client/src/components/VerificationPanel.tsx client/src/components/QuickTest.tsx \
  client/src/lib/layout.ts client/src/lib/storyEdits.ts client/src/lib/analysis.ts \
  client/src/lib/download.ts client/src/lib/editor.test.ts client/src/lib/api.ts \
  client/src/state/useStoryAnalysis.ts client/src/screens/Editor.tsx client/src/screens/Create.tsx \
  client/src/App.tsx client/src/styles.css client/package.json package-lock.json \
  server/src/generate.ts server/src/generate.test.ts server/src/index.ts shared/api.ts \
  docs/03-deviations.md docs/steps/06-editor.md README.md
git commit -m "feat(editor): add map editor with live checks, quick test and .ink export"
```

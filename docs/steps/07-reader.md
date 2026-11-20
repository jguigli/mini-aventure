# Step 7 — Reader

## Goal

A clean, full-screen Lecture mode that plays the **real compiled inkjs story**. If a story plays here, the exported `.ink` works. It reaches both endings, can start from any scene, goes back and forth with Édition without losing the scene, and is fully usable with the keyboard.

## What was built and how it works

### Playback engine (`client/src/lib/player.ts`)
A thin, pure-ish layer over inkjs, tested in Node:
- `startStory(ink, fromSceneId?)`: `ResetState()`, then `ChoosePathString(sceneId)` to start at a scene, which works because the knot name **is** the scene id. An unknown scene falls back to the beginning.
- `choose(ink, index)`: `ChooseChoiceIndex(index)`.
- `readPassage` runs `Continue()` until the next choice or the end and returns a `Passage`:
  - paragraphs of text;
  - choices with their `#emoji:` tag;
  - scene metadata **from the Ink tags** (`scene`, `scene_title`, `emoji`, `mood`);
  - the ending (`ending`, `ending_label`) if any;
  - `ended`, and `error` (inkjs **throws** runtime errors, so they are caught and returned).

`storyTitle(ink)` reads the global `# title:` tag. Nothing in the Reader reads the JSON to play.

To make that possible, the serializer now also writes **`# scene_title:`** in every knot. The `tagValue` helper moved to `lib/inkTags.ts`, shared by the explorer and the player.

### Reader screen (`client/src/screens/Reader.tsx`)
- **Layout**: a centred card on a soft gradient of the scene's mood (green or purple for endings A/B). It shows the story title, a big emoji (`aria-hidden`), the scene title, and the text in an `aria-live="polite"` region. Choices are big buttons with their emoji (`aria-hidden`) and a key hint 1-9.
- **At the end**: « Fin A : La voix libérée » (or a clear message for a dead end or runtime error), a « 🔁 Rejouer » button (restarts from the beginning), and « Fins découvertes : x/N ».
- **Keyboard**: after each step, focus moves to the first choice (or « Rejouer » at the end), so Tab / Enter flows naturally. Keys **1-9** pick a choice directly. Focus is clearly visible (4 px ring).
- **« ✏️ Modifier cette scène »** goes back to Édition with the current scene selected.
- **Robust**: if the story changes while reading (Ctrl+Z still works), it recompiles and resumes at the same scene. A story that does not compile shows its errors and « Retour à l'édition ».

### Mode switching (`screens/Editor.tsx`, `components/ScenePanel.tsx`, `App.tsx`)
- The header toggle **✏️ Édition / 📖 Lecture** is enabled, with `aria-pressed`.
- Lecture starts at the scene selected in Édition, or at the start. Going back to Édition selects the scene being read. « ▶ Jouer depuis ici » is enabled in the scene panel.
- « Vérifier » from Lecture switches to Édition and shows the report.
- **Discovered endings** are kept in memory by `App` for the session and reset when another story opens. The ending on screen is counted immediately.
- The **bottom bar stays in Lecture**, in a quiet style (transparent, small export button), so « ⬇ Exporter le .ink » is always available.

### Map fix
Arrows and their emoji labels no longer catch clicks. React Flow re-enables pointer events on `.react-flow__edge-textwrapper`, so a label lying over a scene card stole the click. The browser test found it.

## Files

Created:
- `client/src/lib/player.ts`, `client/src/lib/player.test.ts`, `client/src/lib/inkTags.ts`
- `client/src/screens/Reader.tsx`
- `docs/steps/07-reader.md`

Modified:
- `client/src/lib/inkSerializer.ts` (`# scene_title:`), `examples/le-phare.ink` (regenerated)
- `client/src/lib/explorer.ts` (uses `inkTags.ts`)
- `client/src/screens/Editor.tsx` (modes), `client/src/components/ScenePanel.tsx` (« Jouer depuis ici »), `client/src/App.tsx` (discovered endings)
- `client/src/styles.css` (Reader, quiet bottom bar, arrows not clickable)
- `docs/03-deviations.md` (section "Step 7"), `README.md`

## Decisions and deviations from docs/02

See [`docs/03-deviations.md`](../03-deviations.md), section "Step 7":
- the new `# scene_title:` tag;
- number keys 1-9;
- the scene is kept when switching modes, in both directions;
- discovered endings kept in memory for the session and counted immediately;
- recompiling when the story changes during reading;
- dead ends and runtime errors are shown;
- the map click fix.

## Library docs checked

- **inkjs 2.4** (`engine/Story.d.ts`):
  - `ChoosePathString(path)` jumps to a knot, and throws for an unknown path (caught, so the story falls back to the start);
  - `ResetState()`, `ChooseChoiceIndex(i)`, `currentChoices[].index/.text/.tags`, `globalTags`.
- **React Flow 13** (`dist/style.css`): `.react-flow__edge-textwrapper { pointer-events: all }` is why labels caught clicks. It is overridden with a more specific selector.

## How to test

```bash
make test       # 140 tests
make dev        # « Charger l'exemple » → 📖 Lecture
```

Acceptance (checked in Chrome driven by Playwright):
- [x] **I play both endings from Lecture.**
  - Ending A with the mouse: « Descendre à la crique » → « Porter le coquillage » → « Fin A : La voix libérée », « Fins découvertes : 1/2 ».
  - Ending B **with the keyboard only**: Enter on the focused « Rejouer » → key `2` → Tab + Enter → « Fin B : La voix perdue », « 2/2 ».
- [x] **Going back and forth with Édition keeps the scene.**
  - « ✏️ Modifier cette scène » at ending B opens Édition with « La voix perdue » selected.
  - 📖 Lecture brings it back at « La voix perdue », and the count stays 2/2.
  - « ▶ Jouer depuis ici » on « Le carnet du gardien » starts there.
  - After one choice, ✏️ Édition selects « Le coquillage qui chante ».
- [x] **I export the `.ink` from Lecture**: the downloaded `le-phare-qui-murmure.ink` contains a text just edited in Édition, and Lecture showed that edit too (same JSON, recompiled).

Also checked:
- [x] On entering Lecture, the focus is on the first choice. At an ending, the focus is on « Rejouer ».
- [x] `aria-pressed="true"` on the active mode.
- [x] The step 6 browser scenario still passes (no regression: map clicks, undo, export, warnings).
- [x] No JavaScript errors in the console.

Unit tests (`client/src/lib/player.test.ts`):
- [x] The first passage comes from Ink tags (scene, title, emoji, mood, choices with emojis) and the story title from global tags.
- [x] Both endings, « Rejouer », starting from a scene, an unknown scene falling back to the start, a choice with no target ending without an ending, and a runtime error reported instead of thrown.

## Known limitations

- « Fins découvertes » is per session and per story. It is not saved: a refresh resets it, as the spec says.
- « Rejouer » always restarts from the beginning, even after « Jouer depuis ici ».
- The Reader's `aria-live` region announces each new passage. With very long texts, screen reader users may prefer to explore the text themselves. This will be reviewed in the accessibility pass (step 10).

## Git

```bash
git add client/src/lib/player.ts client/src/lib/player.test.ts client/src/lib/inkTags.ts \
  client/src/lib/inkSerializer.ts client/src/lib/explorer.ts examples/le-phare.ink \
  client/src/screens/Reader.tsx client/src/screens/Editor.tsx client/src/components/ScenePanel.tsx \
  client/src/App.tsx client/src/styles.css \
  docs/03-deviations.md docs/steps/07-reader.md README.md
git commit -m "feat(reader): play the compiled Ink with both endings, play-from-scene and keyboard support"
```

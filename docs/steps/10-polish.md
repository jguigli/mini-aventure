# Step 10 — Polish and documentation

## Goal

An accessibility pass that can be measured, and a README with which a third party can clone the project, add a key and complete the whole journey on their own.

## What was done and how

### Accessibility
- **Contrast** (`client/src/styles.css`): WCAG ratios were computed for every pair of theme colours used for text. Four were under AA (4.5:1). The accent and success colours were darkened slightly (`--accent #ad4718`, `--accent-hover #8f3a12`, `--good #2a7048`), and every pair now passes AA.
- **Automated audit**: axe-core (WCAG 2.1 A/AA and best practices) was run in Chrome on 6 screens. It found 4 violations: a missing `h1` in the editor and Reader (the visible title is an input, so a visually hidden `h1` was added), and a low contrast on « ✏️ Modifier cette scène » (an opacity, now removed). It now reports **0 violations** on every screen.
- **Keyboard**:
  - a **« Scènes » list** (`components/SceneList.tsx`) in the side panel, as the keyboard and screen-reader alternative to the map. Each scene is a button whose status is spelled out (départ, fin, verrouillée, inaccessible, impasse, problèmes);
  - opening a scene (from the list, the map or the report) **moves the focus to the scene panel heading**;
  - map nodes are taken out of the Tab order (React Flow nodes could be focused but not opened with Enter), and the map's label points to the list.
- **Already in place from earlier steps**, checked again:
  - real `<button>`s and a visible focus ring;
  - `aria-pressed` on the mode toggle and the lock;
  - a native `<dialog>` for the code;
  - `aria-live` on the story text and the reports;
  - emojis `aria-hidden` (except where they are the content);
  - `lang="fr"`;
  - `prefers-reduced-motion`, now also applied to the map.

### README (`README.md`) and screenshots (`docs/images/`)
Written for someone discovering the project. It contains:
- quick start (with and without a key) and commands;
- **a 2-minute demo**;
- features;
- a **Mermaid architecture diagram** with the data flow explained, plus an Ink excerpt, the project layout and the API;
- **design decisions and trade-offs** as a table;
- testing;
- **what was built with AI and how it was checked**;
- known limitations and next steps;
- example sources and licenses.

## Files

Created:
- `client/src/components/SceneList.tsx`
- `docs/images/create.png`, `docs/images/editor.png`, `docs/images/reader.png`
- `docs/steps/10-polish.md`

Modified:
- `client/src/styles.css` (contrast, scene list, reduced motion on the map, focus on programmatic headings)
- `client/src/screens/Editor.tsx` (hidden `h1`, scene list), `client/src/components/ScenePanel.tsx` (focus on open), `client/src/components/StoryMap.tsx` (nodes out of the Tab order, region label)
- `README.md` (rewritten), `docs/03-deviations.md` (section "Step 10")

## Decisions and deviations from docs/02

See [`docs/03-deviations.md`](../03-deviations.md), section "Step 10":
- accessibility measured (contrast computation, axe-core) rather than eyeballed;
- map nodes removed from the Tab order in favour of the scene list;
- the README's "built with AI" section limited to verifiable facts;
- the third-party run simulated on a clean copy.

## Library docs checked

- **axe-core 4.14** (installed in the scratchpad only, not in the project): `axe.run(document, { runOnly: [...] })` with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `best-practice`.
- **React Flow 13**: `nodesFocusable` prop (`ReactFlowProps`).

## How to test

```bash
make test       # 160 tests
make dev        # then try the README's « 2-minute demo »
```

Acceptance:
- [x] **A third party clones the repository, adds their key and completes the whole journey with the README only.** Simulated on a clean copy (no `node_modules`, `.env` or build), following the README literally:
  - `make install` → `make env` (« server/.env created ») → `make test` (160 passed) → `make build` → `make dev`;
  - with **no key**, the home screen shows « Clé OpenAI manquante : renseigne server/.env… Tu peux déjà charger l'exemple. »;
  - the demo path then passes in Chrome: the map, the deliberately broken choice (« Fins atteintes : 1/2 »), Ctrl+Z, the .ink export with the edit, the Reader (both endings, 2/2, export from Lecture), the compiled .json, the re-import (7/7), the inkle example, the axe audit (0) and the keyboard scenario, all with no JavaScript errors;
  - the parts that need a key (generation, rewrite) were validated with real calls in steps 4, 5 and 9.

Also checked:
- [x] Contrast: every theme text pair ≥ 4.5:1 after the change (computed).
- [x] axe-core: **0 violations** on the home screen, the editor (report and scene), the code dialog, the Reader and the import screen.
- [x] Keyboard only: « Charger l'exemple » in 4 Tab presses. The scene list item is reached in 14 Tab presses, and Enter moves the focus to the panel heading « 📓 Scène ». Editing the title works. « Fermer » brings the list back. In Lecture, the focus starts on the first choice, keys `2` then `1` reach « Fin A », and the focus lands on « Rejouer ».
- [x] The step 6 to 9 browser scenarios still pass (no regression).

## Known limitations

- The map itself is mouse-only. The scene list is the keyboard alternative, as the spec allows.
- The Reader's `aria-live` region announces each passage in full. With long texts, a screen-reader user may prefer to explore it themselves.
- The automated audit covers what axe can detect. No manual screen-reader session (VoiceOver, NVDA) was run.
- The README's "Built with AI" section states what was checked automatically. The author should add what they reviewed by hand.

## Git

```bash
git add client/src/components/SceneList.tsx client/src/components/ScenePanel.tsx \
  client/src/components/StoryMap.tsx client/src/screens/Editor.tsx client/src/styles.css \
  docs/images/create.png docs/images/editor.png docs/images/reader.png \
  docs/03-deviations.md docs/steps/10-polish.md README.md
git commit -m "docs: accessibility pass, keyboard scene list and final README"
```

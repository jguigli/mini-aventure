# Deviations from the implementation spec

This file lists every place where the implementation differs from [`02-prompt-implementation.md`](02-prompt-implementation.md), and why. `02` is frozen as the original spec. **When the two disagree, this file wins.** Entries are added as soon as a deviation is made, grouped by step.

Each entry gives: **Spec** (what 02 says) → **Done** (what was implemented) → **Why**.

---

## Project-wide

### Code comments are in English
- **Spec:** everything in French (UI, errors, prompts, stories). The language of code comments was not specified (an earlier CLAUDE.md draft said French).
- **Done:** code comments, commit messages, `README.md`, `docs/steps/` and this file are in English. Everything the end user sees (UI, API error messages, server startup logs), the prompts sent to the LLM and the generated stories stay in French.
- **Why:** the author's request. Code and its documentation share one language.

### Deviations are tracked here, `02` is no longer edited
- **Spec:** n/a.
- **Done:** this file was created after step 1. Steps 1 and 2 were backfilled.
- **Why:** keeps the original spec readable and makes every change easy to defend.

---

## Step 1 — Skeleton

### TypeScript 6: no `baseUrl`
- **Spec:** `@shared/*` alias declared in both tsconfig files.
- **Done:** `paths` is used without `baseUrl`, and resolves relative to each `tsconfig.json`.
- **Why:** the installed TypeScript 6.0 deprecates `baseUrl` (error TS5101, removed in TS 7).

### Server runs through `tsx`, with `Bundler` module resolution
- **Spec:** "Node + Express + TypeScript", with no runner specified.
- **Done:** `tsx watch src/index.ts`. `tsc --noEmit` is used only for type-checking, and imports have no `.js` extension.
- **Why:** no build step for the server, and `tsx` reads tsconfig `paths` at runtime.

### `npm test` passes when there are no tests
- **Done:** `vitest run --passWithNoTests`.
- **Why:** step 1 had no tests yet. The flag does no harm afterwards.

### `GET /` on the API port
- **Spec:** only `GET /api/health`.
- **Done:** `GET /` on port 3001 returns a short text pointing to the app on port 5173.
- **Why:** opening the API port by mistake showed `Cannot GET /`, which looked like a bug.

### Recent library majors
- **Done:** TypeScript 6.0, Vite 8.3, Vitest 4.1, ESLint 10, Express 5.3, React 19.3, dotenv 18. Node **20.19+** is required (Vite 8 and ESLint 10 engines).

---

## Step 2 — Ink core

### Versions: inkjs 2.4, zod 4
- **Spec:** inkjs ≥ 2.2, and "check the zod version compatible with the `openai` SDK".
- **Done:** `inkjs@2.4.0` and `zod@4.x`. `openai@7` declares `zod: ^3.25 || ^4.0` as a peer dependency, so zod 4 is fine. zod is a dependency of the `shared` workspace.
- **Compiler import:** `import { Compiler, Story } from "inkjs/full"`. The default `inkjs` entry only contains the runtime.

### Choice tags go inside the brackets
- **Spec:** `+ [Monter l'escalier] # emoji: 🪜` then `-> escalier` on the next line.
- **Done:** `+ [Monter l'escalier #emoji: 🪜] -> escalier`.
- **Why:** tested on inkjs 2.4. A tag placed after `]` belongs to the text printed *after* choosing, so `choice.tags` is empty. Inside the brackets, it is attached to the choice and is not part of the choice text. The divert is on the same line because it is shorter and equivalent.

### Header: global tags instead of a comment
- **Spec:** `// Titre : Le phare qui murmure`.
- **Done:** `# title: Le phare qui murmure` and `# reading_level: 11-12` as global tags.
- **Why:** a comment is lost at compile time. A global tag is readable through `story.globalTags`, so an imported `.ink` can show its title.

### Extra tag `# ending_label:`
- **Spec:** endings only carry `# ending: A|B`.
- **Done:** an ending also carries `# ending_label: <label>`.
- **Why:** the reader plays the compiled inkjs story, not the JSON, so the ending label must be in the Ink to be shown at the end of the game.

### Every scene without choices ends with `-> END`
- **Spec:** `-> END` is shown on endings only.
- **Done:** any scene with no choices (an ending, or a scene being edited) ends with `-> END`.
- **Why:** otherwise inkjs throws "ran out of content" at runtime. With `-> END`, the explorer can report a non-ending scene with no choices as a dead end, instead of crashing.

### Missing start scene
- **Spec:** n/a.
- **Done:** if `startSceneId` does not exist, the story starts at the first scene. With no scenes at all, it starts with `-> END`.
- **Why:** the Ink must compile during editing. `validateStory` reports the problem (step 3).

### Contextual escaping, verified by round-trip tests
- **Spec:** backslash before `[ ] # { } | \` and before `->`, `<-`, `<>`, `//`, `/*`, and before `* + - = ~` at the start of a line.
- **Done:** the same set, with two corrections found by testing:
  - **Both characters** of `//` and `/*` must be escaped. `\/*` still opens a block comment and silently swallows the rest of the line.
  - A line starting with `TODO` is an author note in Ink and is dropped from the output, so it is escaped as `\TODO`.

  For two-character sequences, only one character is escaped (e.g. `\->`), because `\X` always prints `X`. A `-` inside a word (`peut-être`) is **not** escaped, which keeps the exported `.ink` readable.
- **Why:** every rule is covered by a test that serializes a tricky string, compiles it, plays it, and checks the printed text is identical, for scene text and choice labels.

### Runtime errors throw from `Continue()`
- **Spec:** n/a.
- **Done:** noted for step 3. inkjs throws on runtime errors (e.g. "ran out of content") instead of returning them. The explorer and the reader must catch them.

### Ink reserved words (checked, applied at step 3)
- **Spec:** list of reserved words to refuse as scene ids.
- **Checked:** inkjs 2.4 refuses `not`, `true`, `false`, `else`, `function`, `return` and `temp` as knot names. `end`, `done`, `and`, `or`, `var`, `const`, `list`, `include` and `external` compile. The whole spec list is still refused at step 3, to be conservative.

### Example story
- **Spec:** "5 scenes and 2 endings".
- **Done:** 5 narrative scenes + 2 endings (7 scenes). It includes **one deliberate loop** (`sommet` ↔ `crique`), the reason `+` choices are used. It will exercise the explorer's loop detection at step 3.
- **`examples/le-phare.ink`** is generated from the JSON and kept in sync by a Vitest file snapshot. A serializer change that alters it fails the tests, and `npx vitest run -u` updates it.

---

## Step 3 — Reachability explorer and structural validation

### One loop-detection key for every story
- **Spec:** for generated stories, deduplicate on the `scene:` tag. For imported `.ink`, use `currentPathString` + the text of the offered choices.
- **Done:** a single key for both cases: for each offered choice, its `sourcePath` (where the choice is written in the Ink) + its text.
- **Why:**
  - `currentPathString` is `null` once the story stops at choices (checked on inkjs 2.4), so it cannot identify a decision point. `choice.sourcePath` can (e.g. `cuisine.placard.0.7`).
  - For generated stories (no variables), this key is equivalent to the scene tag, since one scene means one set of choices. One algorithm is simpler to explain and test.
  - A test checks that comparing `state.ToJson()` instead makes 6 tests fail: the visit counters differ on every pass, so loops are never detected.

### `compileInk` compiles with `countAllVisits: true`
- **Spec:** n/a.
- **Done:** `new CompilerOptions(null, [], true)`.
- **Why:** by default inkjs only counts visits to knots that the story reads, so `VisitCountAtPathString` returned 0 everywhere. With the option on, the explorer knows which knots were reached in an imported `.ink` without `# scene:` tags. The cost is negligible.

### Endings and dead ends in an imported `.ink`
- **Spec:** an ending is identified by `currentPathString` before the last `Continue()`. A dead end is a story stopped by `DONE` without a clear ending, or a runtime error.
- **Done:** in an imported `.ink`, **every** place where the story stops counts as an ending. It is identified by its knot (the knot whose visit count went up in that last segment). Only runtime errors count as dead ends.
- **Why:** `END` and `DONE` cannot be told apart at runtime (both leave no choices and `canContinue = false`), and `currentPathString` is `null` at that point. For our generated stories nothing changes: an ending must carry `# ending:`, and anything else that stops is a dead end.

### Explorer result has extra fields
- **Spec:** `{ reachedScenes, reachedEndings, deadEnds, unreachedScenes, truncated }`.
- **Done:** adds `runtimeErrors: string[]` (inkjs throws from `Continue()`, see step 2) and `steps: number`. The `opts.sceneIds` option gives the list of expected scenes. `knotNamesFromSource(source)` lists the knots of an imported `.ink` without its functions, because the compiled story does not mark which containers are functions.

### Choice-level reachability is not reported separately
- **Spec (01 recap):** "all choices are reachable".
- **Done:** not a separate output.
- **Why:** generated stories have no conditions, so a choice is offered exactly when its scene is reached. Unreached scenes cover it. A choice with a missing target is reported by `validateStory` and as a dead end by the explorer.

### `validateStory`: extra checks, issue format
- **Spec:** unique ids, existing targets, exactly 2 endings A and B, 4 to 6 narrative scenes, 2 to 3 choices, valid emojis.
- **Done:** all of these, plus:
  - Ink-valid scene ids and reserved words;
  - unique choice ids within a scene;
  - an ending has no choices, and a scene with no ending must have choices (dead end);
  - the start scene exists and is not an ending;
  - non-empty title, text, choice label and ending label;
  - a choice that leads back to its own scene is reported.

  Each issue is `{ sceneId?, choiceId?, message }`, with the message in French.
- **Why:** these are the mistakes an LLM or a hurried edit actually makes. Each is cheap to check, and the message is precise enough to send back to the LLM.

### Emoji helpers written now
- **Spec:** step 4 (server-side normalization).
- **Done:** `shared/emoji.ts` (`isValidEmoji`, `normalizeEmoji`, `normalizeStoryEmojis`) is written and tested now, because `validateStory` needs `isValidEmoji`. It works on graphemes (`Intl.Segmenter`), so `🏖️` and `👩‍🚀` count as one emoji.

---

## Step 4 — Generation with OpenAI

### `openai@6.49`, Responses API, `zodTextFormat`
- **Spec:** "official `openai` SDK; check the exact JSON-schema response format syntax".
- **Done:** `openai@6.49.0` with `client.responses.parse({ model, instructions, input, text: { format: zodTextFormat(LlmStory, "story") } })`, which returns `response.output_parsed`.
- **Why:** `openai@7` requires Node ≥ 22 and the project targets Node 20.19+, so npm resolved the latest 6.x. Its `zod` peer range (`^3.25 || ^4.0`) accepts zod 4. The generated schema was printed and checked before any paid call: `strict: true`, `additionalProperties: false` everywhere, `plan` first, `ending` as `anyOf [object, null]`.

### Default model `gpt-5.4-mini`, `OPENAI_MODEL` optional
- **Spec:** the model is set by `OPENAI_MODEL`, a light model that supports structured outputs.
- **Done:** `OPENAI_MODEL` stays optional. When it is empty, the server uses `gpt-5.4-mini` (`DEFAULT_MODEL` in `server/src/env.ts`).
- **Why:** the key has access to many models (listed with `models.list()`, a free call). OpenAI's model page confirms structured outputs for `gpt-5.4-mini`, at $0.75 / $4.50 per million input / output tokens. Newer families (`gpt-6-*`) had inconsistent pricing across OpenAI's own pages, so they were not picked blind.

### Retry logic in its own file, with an injected model call
- **Spec:** `server/src/openai.ts` (client and calls), with the retry described in step 4.
- **Done:**
  - `generate.ts`: the workflow (normalize, validate, retry once). The model call is a parameter (`CallModel`).
  - `openai.ts`: the only file that talks to OpenAI.
  - `errors.ts`: maps errors to an HTTP status and a French message.
- **Why:** the retry path is unit-tested with a fake model, at no cost. `openai.ts` stays small and is the only place to change to switch provider.

### `validateStory` also checks the story graph
- **Spec:** reachability is checked by the explorer (Ink, client side). `validateStory` does local structural checks only.
- **Done:** `validateStory` now runs two searches on the JSON graph:
  - forward from the start: every scene must be reachable;
  - backward from the endings: every reachable scene must be able to reach an ending (no loop without an exit).

  It also reports two choices of the same scene that lead to the same place. The system prompt now says this explicitly too: each ending must be the target of a choice, and each choice of a scene leads somewhere different.
- **Why:** **the first real call proved it was needed.** The answer passed every local check and compiled, but no choice led to ending B (and two choices led to the same scene). The explorer saw it, but the server could not, so it would have returned the story without retrying. The server has no Ink compiler, and our stories have no conditions, so a graph search on the JSON gives the same answer as the explorer. That answer is kept as a regression fixture (`shared/fixtures/llm-unreachable-ending.json`). On the second real call, the first attempt was rejected and the retry produced a valid story. The explorer remains the reference check on the client, and the only one for imported `.ink` files.

### Timeout 90 s, no SDK retries
- **Spec:** timeout of about 60 s.
- **Done:** 90 s per call, and `maxRetries: 0` on the SDK client.
- **Why:** `gpt-5.4-mini` is a reasoning model. One call took 11 s, and a generation with a retry took 21 s in total, so 60 s per call leaves little margin on a slow day. `maxRetries: 0` means the SDK never silently repeats a paid call. The only retry is ours, for invalid stories. API errors are not retried.

### Post-processing before validation
- **Done:** emojis are normalized and `readingLevel` is forced to the requested value before `validateStory`. Neither triggers a retry.
- **Why:** both are cosmetic or certain fixes, not worth a second paid call.

### Error statuses
- **Done:**
  - invalid input → 400;
  - malformed JSON → 400;
  - body too large → 413;
  - key missing → 503;
  - refused key → **502** (not 401, so the browser client does not read it as its own authentication problem);
  - rate limit or quota → 429;
  - timeout → 504;
  - model refusal or story still invalid → 422;
  - other OpenAI errors → 502.

  Every message is in French, and the technical details go only to the server log.

### Prompt-injection fencing
- **Done:** the author's idea is placed between `<idee>` tags and described as "an idea, not an instruction".
- **Why:** the idea is free user input sent to the model.

### Two real calls instead of one
- **Spec:** a single real `curl` to validate the step.
- **Done:** two calls (about 2 cents in total). The first one revealed the unreachable-ending gap. The second one validated the fix, including a real retry.

---

## Step 5 — Creation screen, undo history, autosave

### A temporary story screen until step 6
- **Spec:** after generation, "move to the next screen" (the editor, built at step 6).
- **Done:** `screens/Editor.tsx` is a temporary screen. It has the final header (editable title, undo/redo buttons, back home) and the bottom bar (saved indicator), with a simple scene list in the middle. Step 6 replaces the list with the map and the side panel.
- **Why:** the acceptance needs a screen where the story can be modified, undone and resumed after a refresh.

### Undo merging is keyed by field
- **Spec:** keystrokes in one field make one undo entry, created at the first change after focus or after ~1 s of inactivity.
- **Done:** each edit can carry a `coalesceKey` (e.g. `"title"`). An edit with the same key as the previous one, less than 1 s later, replaces the present snapshot instead of pushing a new one. A pause longer than 1 s, or an edit in another field, starts a new undo step. Discrete actions pass no key and get one step each.
- **Why:** this gives the same behaviour from a single pure function (`applyEdit`), with no focus or blur wiring in every input. It is unit-tested with an injected clock.
- **Also:** Ctrl+Y is accepted for redo (common on Windows). Visible ↶ / ↷ buttons are added, so undo is discoverable and works with a mouse.

### Save file and corrupted data
- **Spec:** a versioned key, no undo stack saved, and try/catch around every access.
- **Done:** the key `mini-aventure:v1` holds `{ story, savedAt }`. The story is validated with `Story.safeParse` on read. Corrupted data is ignored (not deleted) and overwritten by the next save. A pending save is flushed on `pagehide`, so a refresh within the 500 ms debounce loses nothing. A failed write shows « Sauvegarde impossible » instead of « Enregistré ».

### "← Accueil" keeps the save
- **Spec:** only the resume banner's "Nouvelle histoire" button clears the save.
- **Done:** leaving the story with "← Accueil" goes back to the creation screen and shows the resume banner. Nothing is deleted.
- **Why:** leaving a screen should never destroy work. Deleting stays an explicit choice.

### Extras on the creation screen
- **Done:**
  - a « Annuler » button during generation (it aborts the request);
  - a notice when the server reports no OpenAI key, read from `/api/health` (the example still works);
  - a character counter (`x/500`);
  - the textarea has `maxLength=500`, so the server limit is never hit from the UI.
- **Why:** a generation takes 10 to 20 s, and the author should be able to give up. A missing key should be explained before the author tries to generate.

### Step 4 follow-up: actionable reachability messages and a stronger plan
- **Context:** on the first real generation from the UI, the model again left ending B with no choice leading to it, and this time **the retry did not fix it** (422 after two attempts). So far, 2 of 3 real generations had this defect on their first attempt.
- **Done:**
  - **Prompt**: `plan.endingA` / `plan.endingB` must now name the ending scene's id and the choice that leads to it, before the scenes are written. The rule "each ending is the target of at least one choice" is flagged as the most frequent mistake.
  - **Message**: the `validateStory` message is now actionable, and is used both in the editor and in the retry: « La fin B « x » n'est jamais atteinte depuis la scène de départ : fais pointer au moins un choix d'une scène atteignable vers « x ». »
- **Not done:** the code does not rewire a choice to an ending by itself. That would mean the code writes story content, against "the LLM proposes, the code verifies, the author decides".
- **Reasoning effort `low`** (`reasoning: { effort: "low" }` in `server/src/openai.ts`): the next failure was a different graph mistake (a choice to a scene that does not exist), and the retry repeated it. Generations taking about 5 s suggested the model answered with no reasoning at all. A small reasoning budget lets it check its own graph before answering. The effective effort and the reasoning tokens are logged.
- **Measured** (4 real calls, authorised by the author, about 4 cents in total):

  | # | Idea (level) | Prompt fix | Reasoning | Result |
  |---|---|---|---|---|
  | 1 | Chat astronaute (8-10) | ✓ | default | ✅ first try, 5.1 s |
  | 2 | Bibliothèque qui change (11-12) | ✓ | default | ❌ 422: choice to a non-existent scene, not fixed by the retry |
  | 3 | Dénoncer ou protéger (13-15) | ✓ | default | ✅ first try, 9.1 s |
  | 4 | Bibliothèque qui change (11-12) | ✓ | `low` | ✅ first try, 9.4 s, 89 reasoning tokens |

  The three valid stories were checked end to end: no validation issues, no compile errors, 100% of scenes and both endings reached, no dead ends. The "ending never reached" defect did not come back after the prompt fix. This is a small sample: it shows the fixes work, not a reliability rate.

### The retry lists the scenes that exist (after the measurements above)
- **Spec:** the retry sends the issues back to the model.
- **Done:** the retry message also lists every scene of the model's answer (id, ending kind, title) as "the ONLY possible values for `targetSceneId`". When a target is missing, it adds: "replace the target with one of these scenes, or add the missing scene with exactly this id".
- **Why:** in call #2 the model invented `escalier_cache`, was told so, and sent the same mistake back. The message said what was wrong, but not what the valid answers were.
- **Supporting change:** every `ValidationIssue` now has a machine-readable `code` (`missing_target`, `unreachable`, `dead_end`…), so the program never has to parse French messages. Step 6 uses the codes too.
- **Not measured with real calls** (the budget for this step is spent). It is unit-tested, and the next real generations will show its effect in the logs (`N essai(s)`).

---

## Step 6 — Map editor

### Option 2: a generation can return a story with warnings
- **Spec (step 4):** if the story is still invalid after the retry, return a clear error.
- **Done:** after the retry, if **every** remaining issue can be fixed in the editor, the server returns `{ story, warnings }` (HTTP 200) instead of a 422. The editor shows a banner, « L'IA a laissé N problème(s)… », and flags them ⚠️ on the map. Issues the editor cannot fix still give a 422: scene ids (not editable), the start scene, the number of endings, duplicate choice ids.
- **Why:** the author's decision after real call #2 (a choice to a scene that did not exist). Losing a whole story over one wrong arrow is worse than letting the author re-target it in two clicks. This is "the code verifies, the author decides".
- **How:** `FIXABLE_IN_EDITOR` in `server/src/generate.ts` is an **allowlist** of issue codes, so a new code is blocking until it is deliberately added. The retry is still always tried first.

### React Flow 13
- **Spec:** `@xyflow/react`, with no version given.
- **Done:** `@xyflow/react@13.0.2`, a newer major than the one I knew best (12). The API used (`ReactFlow`, `Handle`, `Background`, `Controls`, `MarkerType`, `Position`, `NodeProps<Node<Data, Type>>`, `onInit`, `fitView`) was checked in `dist/index.d.ts` before writing code, and matches v12.

### Unreachable endings stay in the endings column
- **Spec:** endings in the last column, unreachable scenes in a separate column.
- **Done:** endings **always** stay in the last column (A above B), greyed and dashed when unreachable. Only unreachable **narrative** scenes go to the separate column.
- **Why:** found in the browser test. When a redirected choice made ending A unreachable, ending A jumped to the unreachable column, outside the visible area. It was flagged in the report, but invisible on the map. Endings staying in place is also what the author expects.

### The map re-frames itself when its structure changes
- **Done:** `fitView` runs again (animated) when a scene is added or removed or changes column, but not on every keystroke.
- **Why:** a new scene or a scene that moves to another column could appear outside the visible area.

### "Impasse" only for real dead ends
- **Done:** the map tag « ⚠️ Impasse » is shown only for a narrative scene with **no choices**. A scene whose choice lost its target shows « ⚠️ 1 » (issue count), and the report says « L'histoire s'arrête sans fin : … ».
- **Why:** the explorer counts both as "the story stops here without an ending", but calling a scene that has choices an "impasse" was misleading.

### Lecture toggle and « ▶ Jouer depuis ici » are present but disabled
- **Spec:** both are part of step 6's header and panel.
- **Done:** both are rendered, disabled, with a tooltip « arrive à l'étape 7 ».
- **Why:** the Reader is step 7. The layout is final, so step 7 only has to enable them.

### Quick test follows the JSON
- **Done:** the quick test under the map walks the JSON graph (current scene highlighted, path lit, choices with a missing target disabled).
- **Why:** it is a structural check while editing. Playing the compiled Ink is the Reader's job (step 7), which is what proves the exported Ink works.

### « Vérifier » shows the report
- **Done:** « Vérifier » runs the checks immediately (skipping the 300 ms debounce) and shows the verification report in the side panel. The report has two separate sections, « Parcours joué par inkjs » (explorer) and « Structure » (`validateStory`), with every scene name clickable. The button turns ✅ or ⚠️ with the live result.

### Keyboard access to the map is deferred
- **Spec (step 10):** a scene list navigable with the keyboard, as an alternative to the map.
- **Done now:** the map is mouse-driven. Every scene named in the report is a keyboard-reachable button that opens the scene. The full keyboard alternative remains in step 10.

---

## Step 7 — Reader

### New Ink tag `# scene_title:`
- **Spec:** the Reader shows « grand emoji de la scène, titre, texte », and uses the real inkjs story, not the JSON.
- **Done:** the serializer now writes `# scene_title: <title>` in every knot, right after `# scene:`. `examples/le-phare.ink` was regenerated through its Vitest file snapshot.
- **Why:** the scene title only existed in the JSON. Reading it from there would break the rule that the Reader plays the Ink only. With the tag, everything the Reader shows comes from the compiled story (text from `Continue()`, metadata from tags), so an exported `.ink` re-imported elsewhere keeps its scene titles.

### Number keys pick a choice
- **Spec:** full keyboard navigation and visible focus.
- **Done:** Tab / Enter on the choice buttons as required, plus keys **1-9** to pick a choice directly (shown as small key hints). After each step, focus moves to the first choice, or to « Rejouer » at the end.
- **Why:** focus management makes the keyboard flow continuous. Number keys are a cheap extra that suits a game.

### Switching modes keeps the scene in both directions
- **Spec:** going back and forth with Édition keeps the scene.
- **Done:** Lecture starts at the scene selected in Édition (or at the start if none). Going back to Édition, with the toggle or « ✏️ Modifier cette scène », selects the scene being read. « ▶ Jouer depuis ici » (now enabled) uses `ChoosePathString(sceneId)`.

### Discovered endings
- **Spec:** « Fins découvertes : x/2 », kept for the session.
- **Done:** kept in memory by the app (not in `localStorage`) and reset when another story is opened. The ending on screen is counted immediately (a browser test showed « 0/2 » for one render otherwise). The total comes from the story's endings (`analysis.endingsTotal`).

### The story can change while reading
- **Done:** if the story changes during Lecture (Ctrl+Z still works there), the Reader recompiles and resumes at the same scene.

### A dead end or a runtime error is shown, not thrown
- **Done:** a choice with no target ends with « L'histoire s'arrête ici sans fin : un choix ne mène nulle part. ». An inkjs runtime error is displayed in the card, and a story that does not compile shows its errors with « Retour à l'édition ».

### Map fix found while testing the Reader
- **Done:** arrows and their emoji labels on the map no longer catch clicks (`pointer-events: none` on `.react-flow__edge` and `.react-flow__edge-textwrapper`, which React Flow re-enables by default).
- **Why:** the browser test could not click « Le carnet du gardien », because an arrow label was lying over it. Arrows are display-only in this app.

---

## Step 8 — Import and export

### Public example: inkle's "conversation with nested nodes", not a full game
- **Spec:** add a public `.ink`, for example from inkle's "Writing with Ink" documentation or the `inkle/ink` repo, with its source URL and license.
- **Done:** `examples/monsieur-fogg.ink` is the "Example: a conversation with nested nodes" from *Writing with ink*. It is copied verbatim (only the Markdown tab indentation was removed). A header comment gives the source URL, pinned to commit `4011b8c`, and the license (MIT, "Copyright (c) 2025 inkle Ltd."). The README lists it too. A « Exemple Ink d'inkle » link on the home screen opens it directly (loaded with Vite's `?raw`).
- **Rejected candidates, and why:**
  - **`LD41 Emoji` ("⏰", Pat Scott, `inkle/ink-library`, MIT):** a fun all-emoji story, but it contains 🖕, 🔫, 🔪 and 🚬, which is not suitable for an app for 8-15 year-olds. It also showed a real limit of our explorer: 0 endings found and the `finale` knot reported unreachable, because its branches are gated by variables and read counts (see below).
  - **The Intercept (`inkle/the-intercept`):** no license declared on the repository.
  - **"back_in_london" (*Writing with ink*):** ends without `-> END`, which is a runtime error.
  - **The `.ink` files in `inkle/ink`:** a few bytes of test fixtures.
- **Why this one:** complete (ends with `-> END`, and the documentation even gives two playthroughs that the tests replay), suitable for children, official, MIT. It also uses *weave* syntax (nested choices and gathers, no knots), which our app never generates, so it is a real test of the text mode.

### Explorer: tried variable-aware keys, kept a depth guard instead
- **Context:** on `LD41 Emoji`, the explorer found no ending, because it treats two visits of the same choices with different variable values as the same decision point.
- **Tried:** adding the global `VAR` values to the decision key. On `LD41 Emoji` this exploded: a `time` counter makes every state distinct, and the recursive search **overflowed the call stack**.
- **Done:** the prototype was reverted (a faithful explorer for arbitrary Ink with state is out of scope). But the crash showed a real risk, so the search now stops at **`MAX_DEPTH = 1000`** choices in a row and reports `truncated` instead of crashing the page. The import screen says that exploration is approximate with variables or conditions.

### Player recognises endings in imported Ink
- **Done:** `player.ts` takes an optional list of knots. For an imported `.ink` without our tags, any place where the story stops counts as an ending, named after the knot it stopped in. This is the same rule as the explorer, so « Fins découvertes : x/N » works for imported files (N comes from the explorer).

### One player component for both screens
- **Done:** the player card was extracted from `Reader.tsx` into `components/InkPlayer.tsx`, used by the Reader (our stories) and by the import screen (any `.ink`). On the import screen, focus only follows the reader's own actions, never a recompilation, so typing in the code editor is never interrupted.

### Export menu
- **Spec:** next to « ⬇ Exporter le .ink », a small menu with « Exporter le .json compilé » and « Voir le code Ink » (with a Copy button).
- **Done as specified.** The menu is a native `<details>` element and the code viewer is a native `<dialog>` (focus trap and Escape for free). The `.json` is `story.ToJson()` from inkjs, compiled from the current Ink at click time. If the story does not compile, an inline message explains why nothing is downloaded. The same bar is used on the import screen, without « Voir le code Ink » (the code is already on screen).

### Import limits
- **Done:** files over 1 MB and empty files are refused with a message, and the same file can be imported twice in a row. Leaving the import screen with unsaved changes asks for confirmation (the import is not autosaved).

---

## Step 9 — AI editing

### Scope: items 1, 3 and 4 done; 2 and 5 not done
- **Spec:** five items by priority. (1) ✨ Retravailler une scène, (2) Vérifier la cohérence, (3) 3 variantes, (4) Verrouiller une scène 🔒, (5) Changer d'idée à partir d'une scène. Acceptance: item 1 at least.
- **Done:** **1** (rewrite with preview and undo), **3** (3 variants in one call) and **4** (lock).
- **Not done:** **2** (AI coherence review) and **5** (regenerate what follows a scene).
- **Why:**
  - 3 and 4 came almost for free with 1. Variants are the same call with `variants: 3`, and the lock is needed anyway for the server to refuse locked scenes.
  - 2 and 5 are separate features with their own prompts, schemas and UI. Item 5 also rewires the graph, so it needs the whole validation and retry pipeline again.
  - In a 4-hour budget, they are better left as documented next steps than done halfway.

### The model never sees choice targets as editable
- **Spec:** the server checks that the choice targets are unchanged.
- **Done:** stronger, by construction.
  - The rewrite schema (`SceneRewrite`) has **no target field at all**: choices come back as `{ id, label, emoji }`. The prompt shows where each choice leads (« mène à »), so labels stay coherent.
  - The server checks that every proposal has **exactly the same choice ids, in the same order**, and an `endingLabel` if and only if the scene is an ending. Otherwise it retries once with the problems, then returns a 422.
  - The client merges a kept proposal with `applySceneRewrite`, which takes only the words and keeps the scene id, ending kind, lock, and every choice's id and target.
- **Why:** a check can be forgotten or wrong. A schema with no field to change cannot be. Even a proposal with reordered choices cannot move an arrow (unit-tested).

### Rewrite request shape
- **Spec:** `POST /api/rewrite { story, sceneId, instruction }` returns `{ scene }`.
- **Done:** `{ story, sceneId, instruction, variants: 1 | 3 }` returns `{ variants: SceneRewrite[] }`.
- **Why:** one shape covers items 1 and 3. Returning the words rather than a full `Scene` is what makes the targets impossible to change.

### Quick actions send full instructions
- **Done:** the four quick actions (Améliorer le style, Plus court, Plus de suspense, Adapter au niveau de lecture) send a precise French instruction (e.g. « Ajoute du suspense, sans rien d'effrayant pour l'âge du lecteur. »). The free instruction is limited to 300 characters and fenced in the prompt (`<consigne>`), like the idea. « Autre proposition » re-runs the last instruction.

### One structured-call helper
- **Done:** `server/src/openai.ts` now has one `callStructured(schema, name, instructions, messages)`, used by both generation and rewrite (same reasoning effort, refusal and truncation handling, and logs).

---

## Step 10 — Polish and documentation

### Accessibility measured, not eyeballed
- **Spec:** an accessibility pass (contrast, focus, `aria` labels, keyboard navigation on the map; at minimum, a scene list navigable as an alternative to the map).
- **Done:**
  - **Contrast**: WCAG ratios were computed for every theme colour pair. Four were under 4.5:1 (orange accent text, white on orange, accent on its pale background, green on pale green). `--accent` went from `#c8541f` to `#ad4718`, `--accent-hover` to `#8f3a12`, and `--good` to `#2a7048`. The look is the same, and the contrast is now AA everywhere.
  - **axe-core audit** of every screen (home, editor with the report, editor with a scene, code dialog, Reader, import), with the WCAG 2.1 A/AA and best-practice rules. 4 violations were fixed (no `h1` in the editor and Reader, and the low contrast of « ✏️ Modifier cette scène », caused by an opacity). The audit now finds **0 violations**.
  - **Keyboard alternative to the map**: a « Scènes » list in the side panel (every scene as a button, with its status spelled out: départ, fin A/B, verrouillée, inaccessible, impasse, n problème(s)). Opening a scene moves the focus to its panel heading.
  - **Map nodes out of the Tab order** (`nodesFocusable={false}`): React Flow nodes could get the focus, but Enter did not open them, so they were useless tab stops. The map's label points to the scene list.
  - **Reduced motion** is also respected on the map (no animated arrows in the quick test, no node transitions).
- **Why:** measured results can be defended, and a keyboard-only scenario confirms the flow: home → « Charger l'exemple » → scene list → edit a title → Lecture → keys 1-9 → « Rejouer ».

### README written for a third party, with screenshots
- **Spec:** install and run, a 2-minute demo, an architecture diagram, trade-offs, what was done with AI and what was reviewed by hand, limits and next steps, example sources.
- **Done:** all of these, plus three screenshots (`docs/images/`), the API table, a testing section and the real-call budget. The architecture diagram is a Mermaid flowchart (rendered by GitHub).
- **"What was done with AI"** states facts only: the spec came from the author, the code was written by Claude Code under the author's direction, the decisions the author took, how each step was verified, and what those checks caught. The author should complete it with what they personally reviewed.

### Third-party run, simulated
- **Done:** the project's files (tracked and new, without `node_modules`, `.env` or build output) were copied to an empty folder, and the README was followed exactly: `make install`, `make env`, `make test` (160 passed), `make build`, `make dev`, all **with no key**. The home screen explains the missing key, and the whole demo path (map, checks, undo, Reader, both endings, exports, import, inkle example, axe audit, keyboard scenario) runs with no errors. Generation and rewrite need a key; they were validated with real calls in steps 4, 5 and 9.

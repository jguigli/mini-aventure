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

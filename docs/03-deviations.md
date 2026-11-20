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

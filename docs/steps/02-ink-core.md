# Step 2 — Ink core: schema, serializer, compilation, example

## Goal

Turn a `Story` (JSON, the source of truth) into Ink text that always compiles, compile it with the official inkjs compiler, and prove both with an example story and tests.

## What was built and how it works

### `shared/schema.ts`: the data model in zod
One definition gives the TypeScript types (`z.infer`), runtime validation and, at step 4, the strict JSON schema sent to OpenAI.
- `LlmStory` / `LlmScene`: what the LLM must return. Every field is required (OpenAI strict mode). `ending` is `.nullable()`, which becomes `anyOf [object, null]`. `plan` is the first field, so the model plans before writing.
- `Story` / `Scene`: the app model, which is the LLM model plus `locked?` (editor only, never sent to the LLM).
- Cardinality and consistency (number of scenes, existing targets…) are deliberately **not** in the schema. `validateStory` checks them at step 3.

### `client/src/lib/inkSerializer.ts`: `storyToInk(story)`
A pure and deterministic function. Output for one scene:

```ink
=== crique ===
# scene: crique
# emoji: 🐚
# mood: mystere
Les galets crissent sous les bottes de Lina. …
+ [Porter le coquillage jusqu'aux vagues #emoji: 🌊] -> fin_lumiere
+ [Remonter au sommet #emoji: 🗼] -> sommet
```

- **Header**: global tags `# title:` and `# reading_level:`, then `-> <startSceneId>`.
- **Tags**: `scene:` (for the explorer), `emoji:` and `mood:` (for display). Endings add `ending: A|B` and `ending_label:` (the reader plays the Ink, not the JSON, so the label must be in the Ink).
- **Choices**: persistent `+` choices, so they do not disappear when the reader comes back to a scene (the example has a loop). The emoji tag is **inside** the brackets, which is the only place where inkjs attaches it to the choice.
- **Escaping** (`escapeInk`): in Ink, `\X` always prints `X`, so we add a backslash only where a character would be read as syntax:
  - always: `[ ] { } | # \`;
  - sequences: `->`, `<-`, `<>`, and both characters of `//` and `/*`;
  - at line start: `* + - = ~` and `TODO`.

  Hyphens inside words are left alone, so the exported `.ink` stays readable.
- **Robust while editing**: the Ink must compile at every keystroke.
  - A choice without a valid target becomes `-> END // destination manquante`.
  - A scene with no choices ends with `-> END`.
  - A missing start scene falls back to the first scene.

  These cases are reported by `validateStory` and the explorer (step 3) instead of breaking compilation.

### `client/src/lib/inkCompile.ts`: `compileInk(source)`
Returns `{ story, errors, warnings }` and **never throws**. inkjs throws `Compilation failed` when there are errors. We catch it and return `compiler.errors` (e.g. `ERROR: line 4: Divert target not found: '-> nope'`).

### `examples/le-phare.json` and `examples/le-phare.ink`
"Le phare qui murmure" (reading level 11-12): a lighthouse keeper hears a voice from the sea. It has 5 narrative scenes and 2 endings (A: the voice is freed, B: the voice is lost), with 2 to 3 choices per scene and one deliberate loop (`sommet` ↔ `crique`). The `.ink` file is generated from the JSON, and a Vitest file snapshot keeps it in sync.

## Files

Created:
- `shared/schema.ts`
- `client/src/lib/inkSerializer.ts`, `client/src/lib/inkCompile.ts`, `client/src/lib/inkSerializer.test.ts`
- `examples/le-phare.json`, `examples/le-phare.ink`
- `docs/03-deviations.md`, `docs/steps/02-ink-core.md`

Modified:
- `shared/package.json` (zod), `client/package.json` (inkjs), `package-lock.json`
- `README.md` (status, Ink format, tests)

## Decisions and deviations from docs/02

All are listed in [`docs/03-deviations.md`](../03-deviations.md), section "Step 2". In short:
- the choice tag goes inside the brackets;
- a global `# title:` tag replaces the `// Titre :` comment;
- a new `# ending_label:` tag;
- `-> END` on every scene without choices;
- a fallback when the start scene is missing;
- two escaping fixes (`/*` needs both characters escaped, and a line can start with `TODO`);
- the example has 7 scenes, including one loop.

## Library docs checked

All checked against the installed inkjs 2.4.0 (`node_modules/inkjs/package.json`, `ink.d.mts`, `compiler/Compiler.d.ts`) and small throwaway scripts:
- **Compiler import**: `inkjs/full` exports `Compiler`, `CompilerOptions` and `Story`.
- **`Compile()`** throws `Compilation failed` on errors, and the details are in `compiler.errors`.
- **Choice tags**: `+ [Go #emoji: 🪜] -> x` gives `choice.tags = ["emoji: 🪜"]` and `choice.text = "Go"`. A tag after `]` gives `[]`.
- **Knot tags** are returned by `currentTags` on the first `Continue()` of the knot. **Global tags** are in `story.globalTags`, and also show up in the first `currentTags`.
- **Escaping**: `\X` prints `X` for any character. `\/*` still opens a block comment, while `\/\*` does not. A `TODO:` line is dropped.
- **Runtime errors** (e.g. a knot without `-> END`) throw from `Continue()`. Step 3 needs to handle this.
- **Reserved words**: `not`, `true`, `false`, `else`, `function`, `return` and `temp` are refused as knot names.
- **zod / openai**: `openai@7` peer dependency is `zod: ^3.25 || ^4.0`, so `zod@4` is compatible.

## How to test

```bash
make test       # 43 tests
make lint
npm run typecheck
```

What the tests cover (`client/src/lib/inkSerializer.test.ts`):
- [x] The example passes `Story.parse`, serializes, and compiles with **no errors and no warnings**.
- [x] The generated `.ink` matches `examples/le-phare.ink` (file snapshot).
- [x] Scene tags and choice emoji tags are visible to the inkjs runtime, and the example can be played to ending A.
- [x] Escaping: 15 tricky strings round-trip unchanged, both as scene text and as choice labels. This covers `[ ] { } | # \`, `->`, `<-`, `<>`, `//`, `/* */`, line-start `- * + = ~`, `TODO:`, and French hyphens.
- [x] Tag values (title, ending label) are escaped.
- [x] A missing target, an empty target, a scene without choices, a missing start scene and an empty story all compile.
- [x] `compileInk` returns errors instead of throwing.
- [ ] Optional, manual: open `examples/le-phare.ink` in [Inky](https://github.com/inkle/inky/releases) and check it compiles.

## Known limitations

- `validateStory` (structure checks: unique ids, reserved words, 2 endings, counts) is not written yet. It belongs to step 3. Until then, a reserved word used as a scene id gives a compile error, which is reported but not explained.
- The Ink produced for an *invalid* story (missing targets) is playable, but ends early. That is intended: it is a warning, not a blocker.
- Nothing in the UI uses the serializer yet (steps 5 to 7).

## Git

Two commits: first the comment translation and rule update (not part of this step), then the step itself.

```bash
git add CLAUDE.md Makefile eslint.config.js vitest.config.ts shared/api.ts \
  server/.env.example server/src/env.ts server/src/index.ts \
  client/vite.config.ts client/src/App.tsx client/src/styles.css
git commit -m "chore: switch code comments to English"

git add shared/package.json shared/schema.ts client/package.json package-lock.json \
  client/src/lib/inkSerializer.ts client/src/lib/inkCompile.ts client/src/lib/inkSerializer.test.ts \
  examples/le-phare.json examples/le-phare.ink \
  docs/03-deviations.md docs/steps/02-ink-core.md README.md
git commit -m "feat(ink): add zod schema, JSON to Ink serializer, compiler wrapper and example story"
```

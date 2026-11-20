# Step 3 — Reachability explorer and structural validation

## Goal

Prove, with code and not with the LLM, that a story is well-formed and that every scene and both endings can actually be reached. Report problems precisely enough to show them in the editor and to send them back to the LLM.

## What was built and how it works

There are two independent checks. They answer different questions.

### 1. `validateStory(story)` in `shared/validate.ts`: is the JSON well-formed?
It runs on the JSON, on both sides (server retry at step 4, editor warnings at step 6). It returns a list of `{ sceneId?, choiceId?, message }`, with messages in French.

| Check | Example message |
|---|---|
| Scene id format `[a-z][a-z0-9_]*`, not an Ink reserved word, unique | `L'identifiant « not » est un mot réservé d'Ink.` |
| Start scene exists and is not an ending | `La scène de départ « ailleurs » n'existe pas.` |
| Ending ⇔ no choices | `Impasse : la scène n'a ni choix ni fin.` |
| Every choice target exists | `Destination manquante : la scène « x » n'existe pas.` |
| Exactly 2 endings, one A and one B | `L'histoire doit avoir exactement 2 fins…` |
| 4 to 6 narrative scenes, 2 to 3 choices each | `La scène propose 1 choix au lieu de 2 à 3.` |
| Single valid emojis, non-empty title, text and labels, unique choice ids, no self-loop | … |

Supporting code:
- `isValidSceneId`, `INK_RESERVED_WORDS` and `LIMITS` are exported for the editor (step 6, new scene ids).
- `shared/emoji.ts` works on **graphemes** (`Intl.Segmenter`), so `🏖️` and `👩‍🚀` are one emoji. `isValidEmoji` checks for exactly one pictographic grapheme. `normalizeEmoji` keeps the first one or falls back to 📖. `normalizeStoryEmojis` (for step 4) fixes a whole story without mutating it.

### 2. `explore(inkStory, opts)` in `client/src/lib/explorer.ts`: can everything be reached?
It runs on the **compiled** Ink, by playing it. It is a depth-first search over decision points:

1. **Run** with `Continue()` until the story stops, collecting tags.
2. **Record** the scene reached: the `# scene:` tag, plus every knot whose visit count is above 0 (for imported `.ink` files without tags).
3. **End of a branch**: an `# ending:` tag means an ending is reached. Otherwise, in one of our stories, it is a **dead end**, attributed to the scene (or, for a missing target, the scene where the choice was made). In an imported `.ink`, any end counts as an ending, identified by its knot.
4. **Decision point**: if its key was already explored, skip it. **This is what stops loops.** The key is each choice's `sourcePath` + its text. We deliberately do not compare `state.ToJson()`: it contains visit and turn counters that change on every pass, so a loop would never look "already seen".
5. **Try every choice**: save `state.ToJson()`, then for each choice `ChooseChoiceIndex(i)`, recurse, and `state.LoadJson(saved)`.
6. **Safety net**: after `maxSteps` choices (10,000 by default) it stops and sets `truncated: true`.

Runtime errors (inkjs **throws** them from `Continue()`) are caught, reported in `runtimeErrors`, and counted as dead ends. The explorer resets the story state before and after it runs.

Result: `{ reachedScenes, reachedEndings, deadEnds, unreachedScenes, runtimeErrors, truncated, steps }`.

Supporting changes:
- `compileInk` now compiles with **`countAllVisits: true`**. Without it, inkjs does not count visits to knots and the explorer would be blind on imported `.ink` files.
- `knotNamesFromSource(source)` lists the knots of an imported `.ink`, minus functions, which become `sceneIds`.

## Files

Created:
- `shared/validate.ts`, `shared/emoji.ts`, `shared/validate.test.ts`
- `client/src/lib/explorer.ts`, `client/src/lib/explorer.test.ts`
- `docs/steps/03-explorer.md`

Modified:
- `client/src/lib/inkCompile.ts` (`countAllVisits`)
- `docs/03-deviations.md` (section "Step 3")
- `README.md` (status, "How the app checks a story")

## Decisions and deviations from docs/02

All of them are in [`docs/03-deviations.md`](../03-deviations.md), section "Step 3". In short:
- one loop-detection key for all stories, because `currentPathString` is `null` at a decision point;
- `countAllVisits: true` at compile time;
- in an imported `.ink`, every place where the story stops is an ending (`END` and `DONE` cannot be told apart at runtime);
- extra result fields (`runtimeErrors`, `steps`);
- no separate choice-level reachability;
- extra structural checks;
- emoji helpers written now.

## Library docs checked

All checked against inkjs 2.4.0 typings (`engine/Story.d.ts`, `engine/StoryState.d.ts`, `engine/Choice.d.ts`) and throwaway scripts:
- `state.currentPathString` is `null` after `Continue()` stops at choices and at the end, so it cannot be used as a key.
- `choice.sourcePath` gives the choice's position (`hall.0.17`, `cuisine.placard.0.7`), and its first segment is the knot.
- `state.VisitCountAtPathString(knot)` returns 0 for every knot unless the story is compiled with `CompilerOptions(..., countAllVisits = true)`.
- `mainContentContainer.namedContent` lists the knots, but also functions and `"global decl"`. That is why `knotNamesFromSource` exists.
- A knot without `-> END` compiles with a warning and throws `RUNTIME ERROR: … ran out of content` at runtime.

## How to test

```bash
make test       # 87 tests
make lint
npm run typecheck
```

Acceptance criteria:
- [x] **The example passes at 100%**: 7/7 scenes, endings A and B, no dead end, no runtime error, not truncated, despite its `sommet ↔ crique` loop.
- [x] **Orphan scene and dead end are reported precisely**: `unreachedScenes = ["grotte"]` and `deadEnds = ["carnet"]`. `validateStory` reports the same `carnet` with `Impasse : …`.

Other cases covered:
- [x] Each decision point is explored exactly once: 12 steps for the 12 choices of the example.
- [x] A tight ping-pong loop finishes within a 50-step budget.
- [x] An ending that becomes unreachable is reported (`unreachedScenes = ["fin_lumiere"]`, endings `{B}`).
- [x] A choice with a missing target is reported as a dead end on its scene.
- [x] A step budget that is too small gives `truncated: true`.
- [x] Imported `.ink` with a `VAR` counter that changes on every loop: it finds the 2 endings and the never-reached knot, and does not count the function as a scene.
- [x] A runtime error is reported, not thrown.
- [x] **Mutation check**: replacing the key with `state.ToJson()` makes 6 explorer tests fail. The tests do catch the classic loop bug.
- [x] `validateStory`: the example is clean, and each rule has a failing case. Emoji: composed emojis are accepted, and multiple or text values are rejected or normalized.

## Known limitations

- For an imported `.ink` **with variables**, the decision key is an approximation. Two visits of the same choices with different variable values are treated as one, so a branch that only opens under a condition can be missed. `maxSteps` remains the safety net. This is acceptable for the "text mode" import of step 8.
- When an imported segment crosses several knots before ending, the ending is named after one of them.
- Nothing in the UI uses this yet (step 6).

## Git

```bash
git add shared/validate.ts shared/emoji.ts shared/validate.test.ts \
  client/src/lib/explorer.ts client/src/lib/explorer.test.ts client/src/lib/inkCompile.ts \
  docs/03-deviations.md docs/steps/03-explorer.md README.md
git commit -m "feat(explorer): add reachability explorer, story validation and emoji checks"
```

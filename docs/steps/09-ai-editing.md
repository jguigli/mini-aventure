# Step 9 — AI editing

## Goal

Let the author ask the AI to rework one scene, see a before/after preview, and keep the result (undoable) or cancel, without the AI ever being able to break the story's structure. Done: item 1 (rewrite) of the spec's priority list, plus items 3 (3 variants) and 4 (lock).

## What was built and how it works

### Server: `POST /api/rewrite` (`server/src/rewrite.ts`, `prompts.ts`, `openai.ts`)
```
{ story, sceneId, instruction, variants: 1|3 }
   │ zod: instruction 1-300 chars, variants 1 or 3
   ▼
rewriteScene ── unknown scene → 400 · locked scene 🔒 → 409 (no model call)
   │
   ▼
model (structured outputs, schema LlmSceneRewrites) ── words only, NO targets
   │
   ▼
checkRewrites: same choice ids, same order · endingLabel iff ending · non-empty texts
   │ problems → one retry with the problems listed → still wrong → 422
   ▼
tidy (single emojis, trimmed) → { variants }
```
- **The schema cannot change a destination.** `SceneRewrite` is `{ title, emoji, mood, text, choices: [{ id, label, emoji }], endingLabel }`: there is no target field. The prompt tells the model where each choice leads (« mène à ») so it writes coherent labels, but it cannot move an arrow.
- **Prompt** (French): the same children's-author role and safety rules; keep the exact choices; stay coherent with the rest of the story; respect the reading level (its guidance is included); one concrete emoji per field; make the variants really different. The user message holds the story as context (title, summary, list of scenes), the scene as JSON with each choice's destination, and **the author's instruction fenced** in `<consigne>`.
- **One helper** `callStructured(schema, name, instructions, messages)` now serves both generation and rewrite (reasoning effort `low`, refusal and truncation handling, token and reasoning logs).

### Client (`components/RewritePanel.tsx`, `lib/storyEdits.ts`, `lib/api.ts`)
- **In the scene panel**, near the top: four **quick actions** (« Améliorer le style », « Plus court », « Plus de suspense », « Adapter au niveau de lecture »), each sending a precise instruction. There is also a **free instruction** (« Ou ta consigne », 300 characters max) with « Proposer », and a **« Proposer 3 variantes »** checkbox.
- **While waiting**: « ✨ L'IA réécrit la scène… » with « Annuler ». The request is also cancelled if the author selects another scene.
- **Preview**: the current scene (« Avant », dashed) and the proposal or proposals (« Après » / « Proposition 1-3 »): title, text, choices, ending label. Each proposal has **« Garder »** / « Garder celle-ci ». Below them, « Annuler » and « Autre proposition » (re-runs the same instruction).
- **Keep** = `storyStore.edit(s => applySceneRewrite(s, sceneId, variant))`: one discrete edit, so **one undo step**. `applySceneRewrite` takes only the words and keeps the scene id, ending kind, lock, and every choice's id and **target**. Choices are matched by id, so even reordered proposals cannot move an arrow.
- **Lock 🔒** (`setLocked`): a « 🔓 Verrouiller / 🔒 Verrouillée » toggle (`aria-pressed`) in the panel header. A locked scene shows « 🔒 Scène verrouillée : l'IA n'y touche pas » instead of the AI controls, and a 🔒 tag on the map. The server refuses it too (409).
- Live checks still apply after keeping a proposal (map, ✅/⚠️, autosave).

## Files

Created:
- `server/src/rewrite.ts`, `server/src/rewrite.test.ts`
- `client/src/components/RewritePanel.tsx`
- `docs/steps/09-ai-editing.md`

Modified:
- `shared/schema.ts` (`SceneRewrite`, `LlmSceneRewrites`), `shared/api.ts` (`RewriteRequest`, `RewriteResponse`, `API_REWRITE_PATH`)
- `server/src/openai.ts` (`callStructured`, `callOpenAiForRewrite`), `server/src/prompts.ts` (`REWRITE_SYSTEM_PROMPT`, `buildRewriteInput`), `server/src/index.ts` (route)
- `client/src/lib/storyEdits.ts` (`applySceneRewrite`, `setLocked`), `client/src/lib/api.ts` (`postJson`, `requestRewrite`), `client/src/lib/editor.test.ts`
- `client/src/components/ScenePanel.tsx` (rewrite panel, lock toggle), `client/src/components/StoryMap.tsx` (🔒 tag), `client/src/styles.css`
- `docs/03-deviations.md` (section "Step 9"), `README.md`

## Decisions and deviations from docs/02

See [`docs/03-deviations.md`](../03-deviations.md), section "Step 9":
- items 1, 3 and 4 done, 2 and 5 not done (with the reasons);
- targets made impossible to change by the schema, not only checked;
- the request and response shape (`variants`);
- the quick-action instructions;
- the shared `callStructured` helper.

## Library docs checked

- **`openai` SDK**: same `responses.parse` + `zodTextFormat` as step 4. The new schema uses `.nullable()` for `endingLabel` (strict mode). Its generated JSON schema was exercised by the real call below.
- **zod 4**: `z.union([z.literal(1), z.literal(3)]).default(1)` for `variants`, and `z.input<>` for the client request type (where `variants` is optional).

## How to test

```bash
make test       # 160 tests
make dev        # « Charger l'exemple » → click « Le coquillage qui chante » → ✨
```

Acceptance (checked in Chrome driven by Playwright, `/api/rewrite` intercepted, so no cost):
- [x] **I rewrite a scene**: « Plus court » on « Le coquillage qui chante » sends `{ sceneId: "crique", instruction: "Rends la scène plus courte…", variants: 1 }`.
- [x] **I see the preview**: 2 cards, « Avant: Le coquillage qui chante » and « Après: La flaque qui chante 1 ».
- [x] **I keep it**: the title field, the map node and the text are updated. **The targets are unchanged** (`fin_lumiere, fin_brume, sommet`), and the check stays ✅.
- [x] **Then Ctrl+Z restores the previous version**: the title is back to « Le coquillage qui chante ».

Also checked in the browser:
- [x] « Annuler » after a preview changes nothing and adds no undo step.
- [x] « Proposer 3 variantes » + the free instruction « Fais parler le coquillage » shows 3 proposals. « Garder celle-ci » on the 3rd keeps the 3rd.
- [x] 🔓 → 🔒 Verrouillée (`aria-pressed="true"`): the AI controls are replaced by the locked message, and the map node shows 🔒.
- [x] No JavaScript errors in the console.

**One real call** (the only paid call of this step): « Plus de suspense » × 3 variants on « Le coquillage qui chante ». **OK in 4.9 s, 1 attempt, 3 variants**, 904 input / 606 output tokens (≈ $0.003), 131 reasoning tokens. The three proposals are really different (« Le coquillage qui bat », « La chanson de la flaque », « Le secret du coquillage »), add suspense without anything scary, keep 4 sentences (level 11-12) and keep the three choices. After « Garder celle-ci », the targets are `fin_lumiere, fin_brume, sommet` and the check is ✅.

Unit tests (`server/src/rewrite.test.ts`, `client/src/lib/editor.test.ts`):
- [x] Valid proposals are returned. 3 variants when asked.
- [x] A locked scene is refused (409) **without calling the model**. An unknown scene is refused (400).
- [x] Changed choices trigger a retry whose message says « exactement [c1, c2, c3] ». Still wrong after the retry → 422. Reordered choices are rejected.
- [x] The ending label is required for an ending and must be null otherwise.
- [x] Emojis and spaces are fixed without a retry.
- [x] The prompt contains the reading level, the story context, where each choice leads, and the fenced instruction.
- [x] The request is validated with French messages, `variants` defaults to 1, and 2 is refused.
- [x] `applySceneRewrite` keeps ids, targets, ending kind and lock, even with reordered choices, and never mutates its input. `setLocked` works.

## Known limitations

- **Not done**: item 2 (an AI coherence review that flags ⚠️ on the map) and item 5 (regenerate what follows a scene). Both are documented as next steps.
- A rewrite does not check the reading level or the length of the new text: the prompt asks for it, the code does not measure it.
- On the map, an arrow's emoji label can overlap a scene title (cosmetic, already noted at step 6).

## Git

```bash
git add shared/schema.ts shared/api.ts \
  server/src/rewrite.ts server/src/rewrite.test.ts server/src/openai.ts server/src/prompts.ts server/src/index.ts \
  client/src/components/RewritePanel.tsx client/src/components/ScenePanel.tsx client/src/components/StoryMap.tsx \
  client/src/lib/storyEdits.ts client/src/lib/api.ts client/src/lib/editor.test.ts client/src/styles.css \
  docs/03-deviations.md docs/steps/09-ai-editing.md README.md
git commit -m "feat(ai): rewrite a scene with preview, 3 variants and scene lock"
```

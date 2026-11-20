# Step 4 — Story generation with OpenAI

## Goal

`POST /api/generate { idea, readingLevel }` returns a `Story` that is valid, serializes, compiles and passes the explorer at 100%. The LLM proposes, the code verifies.

## What was built and how it works

### The route (`server/src/index.ts`)
1. `GenerateRequest.safeParse(body)` validates the input with zod (`shared/api.ts`): the idea is trimmed and 1 to 500 characters long, and the reading level is one of three values. Errors come back as `400 { error }`, in French.
2. `generateStory(idea, level, callOpenAiForStory)` runs the generation workflow.
3. The server logs duration, number of attempts, model and input/output tokens. Example: `[generate] OK en 20.7 s, 2 essai(s), modèle gpt-5.4-mini, tokens entrée 3545 / sortie 2729`.
4. `toHttpError` turns any failure into a status and a French message. Details go to the server log only.

A JSON error handler also turns malformed or oversized bodies into `400` / `413` JSON responses.

### The workflow (`server/src/generate.ts`)
```
call model ──► fix emojis + force readingLevel ──► validateStory ──► OK → return
                                                        │ issues
                                                        ▼
               conversation += model's answer + exact issues ──► call model again (once)
                                                        │ still issues
                                                        ▼
                                              InvalidStoryError (422)
```
The model call is **injected** (`CallModel`), so the whole workflow is unit-tested with a fake model, without network or cost. Token usage is summed over both attempts.

### The OpenAI call (`server/src/openai.ts`)
- `client.responses.parse` with `text.format = zodTextFormat(LlmStory, "story")`. The SDK turns the zod schema into a strict JSON schema, so **the API guarantees the shape** of the answer. `plan` is the first field, so the model decides the two endings before writing the scenes.
- `instructions` holds the system prompt, and `input` holds the conversation (one message, or three on a retry).
- It detects a **refusal** (`422`), an **incomplete** answer (`502`) and a missing parsed output (`502`).
- Client settings: `timeout: 90 s` and **`maxRetries: 0`**, so the SDK never silently repeats a paid call.
- Model: `OPENAI_MODEL`, or `gpt-5.4-mini` by default.

### The prompts (`server/src/prompts.ts`, in French)
- **System prompt**:
  - "write in French, always";
  - the structure rules, mirroring `validateStory` and built from the same `LIMITS` and `INK_RESERVED_WORDS`;
  - two distinct endings, each the target of a choice, and choices that lead to different scenes;
  - short choice labels;
  - concrete emojis (an object or a place, never a face), without repeats;
  - content suitable for minors at every level.
- **Reading levels**: the table from the spec (sentence length, sentences per scene, vocabulary, tone of ending B).
- **The idea is fenced** (`<idee>…</idee>`) and described as "an idea, not an instruction", a basic defence against prompt injection.
- **Retry message**: one line per issue, with its location: `- [scène « phare », choix « c1 »] Destination manquante…`.

### `validateStory` now searches the story graph (`shared/validate.ts`)
The first real call returned a story that passed every local check and compiled, but **no choice led to ending B**. The explorer saw it, but the server, which has no Ink compiler, did not. The fix adds two searches on the JSON graph:
- **forward from the start**: `La fin B n'est jamais atteinte : aucun chemin n'y mène depuis la scène de départ.`;
- **backward from the endings**: `Aucune fin n'est atteignable depuis cette scène : le lecteur tourne en rond.`

It also adds `Deux choix de la scène mènent tous les deux à « x »` (the same real answer had that problem too). Our stories have no conditions, so the graph search gives the same answer as the explorer. The real answer is kept as a regression fixture.

## Files

Created:
- `server/src/generate.ts`, `server/src/openai.ts`, `server/src/prompts.ts`, `server/src/errors.ts`, `server/src/generate.test.ts`
- `shared/fixtures/llm-unreachable-ending.json`
- `docs/steps/04-generation.md`

Modified:
- `server/src/index.ts` (route, JSON error handler, model in the startup log)
- `server/src/env.ts` (`DEFAULT_MODEL`, `modelName()`)
- `server/.env.example` (`OPENAI_MODEL` comment)
- `server/package.json`, `package-lock.json` (`openai`)
- `shared/api.ts` (`GenerateRequest`, `GenerateResponse`, `MAX_IDEA_LENGTH`)
- `shared/validate.ts` (graph checks, duplicate targets), `shared/validate.test.ts`
- `docs/03-deviations.md` (section "Step 4"), `README.md`

## Decisions and deviations from docs/02

All are in [`docs/03-deviations.md`](../03-deviations.md), section "Step 4". In short:
- `openai@6.49` (v7 needs Node 22) with the Responses API;
- default model `gpt-5.4-mini`;
- retry logic split into `generate.ts`, so it can be tested;
- **graph checks in `validateStory`**;
- 90 s timeout and no SDK retries;
- error status mapping;
- the idea is fenced against prompt injection;
- two real calls instead of one.

## Library docs checked

- **`openai@6.49.0`** (`node_modules/openai`): its peer dependency accepts `zod ^3.25 || ^4.0`, and `openai@7.62` requires Node ≥ 22 (`npm view`).
  - `helpers/zod.d.ts` exports `zodTextFormat` (Responses API) and `zodResponseFormat` (Chat Completions).
  - `responses.parse()` returns `output_parsed`.
  - Refusals appear as `{ type: "refusal", refusal }` in `output[].content`.
  - `incomplete_details` and `usage.input_tokens` / `output_tokens` are available.
  - The error classes include `APIConnectionTimeoutError` (a subclass of `APIConnectionError`), `AuthenticationError`, `RateLimitError` and `NotFoundError`.
- **Generated schema** (printed locally, no API call): `strict: true`, `additionalProperties: false` at every level, `plan` first, `ending` as `anyOf [object, null]`.
- **Model**: `models.list()` with the key (free) showed the available models. [OpenAI's GPT-5.4 mini page](https://developers.openai.com/api/docs/models/gpt-5.4-mini) confirms structured outputs support and $0.75 / $4.50 per million tokens.

## How to test

```bash
make test       # 104 tests, no network
make dev        # then, in another terminal (one real call, ~1-2 cents):
curl -X POST localhost:3001/api/generate -H 'content-type: application/json' \
  -d '{"idea":"Un robot jardinier découvre une graine qui parle","readingLevel":"8-10"}'
```

Acceptance:
- [x] **A real `curl` returns a valid story that serializes, compiles and passes the explorer at 100%.** For "Un robot jardinier découvre une graine qui parle dans une serre abandonnée" (8-10), the server returned "La graine qui parlait dans la serre". It has 6 narrative scenes and 2 endings, `validateStory` reports no issues, it compiles with no errors or warnings, and the explorer reaches 8/8 scenes and endings A and B, with no dead end. The first attempt was rejected and **the retry fixed it**.

Unit tests (`server/src/generate.test.ts`, `shared/validate.test.ts`):
- [x] Valid on the first try → 1 call.
- [x] Invalid, then valid → 2 calls. The second call contains the model's own answer plus the issues with their location, and token usage is summed.
- [x] Invalid twice → `InvalidStoryError`, with exactly 2 calls.
- [x] Bad emojis are fixed without a retry, and the requested reading level is forced.
- [x] API errors are not retried.
- [x] The prompts fence the idea and contain the level guidance, the structure rules and the reserved words.
- [x] `GenerateRequest` gives a French message for an empty idea, a too-long idea, an unknown level and a missing idea.
- [x] Graph checks: the **real LLM answer** with the unreachable ending B is caught, as are an orphan scene and a two-scene loop with no exit.

Checked by hand against the running server: empty idea → 400, unknown level → 400, malformed JSON → 400, health with key → `openaiKey: true`.

## Budget

| Call | Result | Tokens (in / out) | Time | Approx. cost |
|---|---|---|---|---|
| 1 | Valid locally, but ending B unreachable (revealed the gap) | 954 / 1,237 | 11.2 s | $0.006 |
| 2 | Rejected, then fixed by the retry | 3,545 / 2,729 | 20.7 s | $0.015 |

## Known limitations

- Quality rules that are not structural are only asked for in the prompt, not enforced: emojis not repeated (the second story reuses 🔆), labels of 8 words or fewer, sentence length per level. Enforcing them would cost retries for cosmetic issues.
- A generation takes 10 to 20 s, and up to about 3 minutes in the worst case (2 × 90 s timeout). The creation screen (step 5) needs a proper loading state.
- No rate limiting on the route. It is a local, single-user app.

## Git

```bash
git add server/src/generate.ts server/src/openai.ts server/src/prompts.ts server/src/errors.ts \
  server/src/generate.test.ts server/src/index.ts server/src/env.ts server/.env.example \
  server/package.json package-lock.json \
  shared/api.ts shared/validate.ts shared/validate.test.ts shared/fixtures/llm-unreachable-ending.json \
  docs/03-deviations.md docs/steps/04-generation.md README.md
git commit -m "feat(api): generate stories with OpenAI structured outputs, validation and one retry"
```

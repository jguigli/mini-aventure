# Mini-aventure

A local web app to create short interactive adventures for readers aged 8 to 15, in the [Ink](https://www.inklestudios.com/ink/) format. An author types an idea, an LLM (OpenAI) drafts the story, and the author edits it on a visual map, plays it, checks that every scene and ending is reachable, and exports it as `.ink`.

> The app's interface and generated stories are in French. The code, its comments and its documentation are in English.

**Guiding principle: the LLM proposes, the code verifies, the author decides.**

## Status

Work in progress, built step by step (see [`docs/steps/`](docs/steps/)). Deviations from the original spec are listed in [`docs/03-deviations.md`](docs/03-deviations.md).

| Step | Content                                                                       | Status |
| ---- | ----------------------------------------------------------------------------- | ------ |
| 1    | Project skeleton, health check, Makefile                                      | ✅     |
| 2    | Ink core: zod schema, JSON → Ink serializer, compilation, example story       | ✅     |
| 3    | Reachability explorer, structural validation, emoji checks                    | ✅     |
| 4    | Story generation with OpenAI (structured outputs, validation, one retry)      | ✅     |
| 5    | Creation screen, undo/redo history, browser autosave and resume               | ✅     |
| 6    | Map editor: React Flow map, scene panel, live checks, quick test, .ink export | ✅     |
| 7–10 | Reader, import/export, AI editing, polish                                     | ⏳     |

## Requirements

- Node.js **20.19+** (or 22.12+), npm 10+
- `make` (preinstalled on macOS and Linux)
- An OpenAI API key

## Getting started

```bash
make install   # install all dependencies (npm workspaces)
make env       # create server/.env from server/.env.example (never overwrites an existing file)
```

Open `server/.env` and paste your key:

```dotenv
OPENAI_API_KEY=sk-...
OPENAI_MODEL=
```

`server/.env` is ignored by git. The key is only read by the server and is never sent to the browser.

```bash
make dev       # start the API (port 3001) and the client (http://localhost:5173)
```

Open http://localhost:5173. The page shows **« API OK, clé OpenAI configurée »** when everything is wired up, or a warning if the key is missing. Without a key the server still starts and logs `Clé manquante : renseigne server/.env`.

## Commands

| Command                     | What it does                              |
| --------------------------- | ----------------------------------------- |
| `make help`                 | List the commands                         |
| `make install`              | Install dependencies                      |
| `make env`                  | Create `server/.env` if it does not exist |
| `make dev`                  | Start the server and client together      |
| `make test`                 | Run unit tests (Vitest)                   |
| `make lint` / `make format` | ESLint / Prettier                         |
| `make build`                | Type-check both apps and build the client |
| `make clean`                | Remove `node_modules` and build outputs   |

## Project layout

```
client/   Vite + React + TypeScript (UI, Ink compilation and playback in the browser)
server/   Express + TypeScript (holds the OpenAI key, /api/* routes)
shared/   Code used by both sides, imported as @shared/* (API contract, schemas, validation)
docs/     Design notes and one doc per implementation step
```

The browser calls `/api/*`, which the Vite dev server proxies to Express on port 3001. There is no CORS setup, and the client never knows the key.

## API

| Route                | Body                                                               | Response                                                                                          |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `GET /api/health`    |                                                                    | `{ "ok": true, "openaiKey": true \| false }` (reports whether a key is set, never the key itself) |
| `POST /api/generate` | `{ "idea": string, "readingLevel": "8-10" \| "11-12" \| "13-15" }` | `{ "story": Story }`, or `{ "error": string }` with a French message                              |

Try it (one real, paid call, about 1–2 cents):

```bash
curl -X POST localhost:3001/api/generate -H 'content-type: application/json' \
  -d '{"idea":"Un robot jardinier découvre une graine qui parle","readingLevel":"8-10"}'
```

## Using the app (so far)

1. **Create**: type an idea, pick a reading level (8-10, 11-12 or 13-15), and click **« Générer l'aventure »**. Generation takes 10 to 20 s and can be cancelled. Or click **« Charger l'exemple »** to open the built-in story without calling the API.
2. **Edit on the map**: each scene is a card (emoji, title, mood colour; ending A in green, ending B in purple), and each choice is an arrow. Click a scene to edit it in the side panel: title, emoji, mood, text, choices (label, emoji, target), plus « + Ajouter un choix », « + Nouvelle scène » and « Supprimer la scène ».
3. **Live checks**: about 0.3 s after each change, the story is validated, serialized to Ink, compiled by inkjs and explored. Unreachable scenes turn grey and dashed, and problems get a ⚠️. **« Vérifier »** opens the full report. Problems warn, they never block.
4. **Quick test**: under the map, click choices to walk through the story. The path lights up on the map, and « Réinitialiser » starts over.
5. **Export**: **« ⬇ Exporter le .ink »** in the bottom bar downloads `<title>.ink`, serialized from the current story.
6. **Undo / redo**: Ctrl+Z / Ctrl+Shift+Z (Cmd on macOS), or the ↶ / ↷ buttons. Typing in a field is undone in one step. Inside a text field, Ctrl+Z is the browser's own undo for that field.
7. **Autosave**: the story is saved in the browser about 0.5 s after each change (« ✓ Enregistré »). After a refresh, the home screen offers **« Reprendre ton aventure »**.

If the AI cannot fix a problem even after its retry, but the problem can be fixed in the editor (e.g. a choice pointing to a scene that does not exist), the story still opens, with a banner and the problem flagged on the map.

## How a story is generated

1. The request is validated (idea: 1 to 500 characters, reading level).
2. The model (`gpt-5.4-mini` by default, set `OPENAI_MODEL` to change it; reasoning effort `low`, so it checks its own story graph before answering) is called with **structured outputs**: the zod schema `LlmStory` becomes a strict JSON schema, so the API guarantees the shape of the answer. `plan` is the first field, so the model plans the two endings before writing the scenes.
3. The code fixes what it can on its own (emojis, reading level), then runs `validateStory`.
4. If the story is still invalid, the server retries **once**, sending the model its answer, the exact issues (e.g. `[scène « phare », choix « c1 »] Destination manquante…`) and the list of scenes that really exist. If issues remain after that, the story is returned **with warnings** when every issue can be fixed in the editor; otherwise the server returns a clear error.
5. Duration and token usage are logged for each generation, to keep an eye on the budget. A typical generation uses about 2,000 tokens (under 1 cent) and takes 10 to 20 s.

The system prompt is in French, adapts sentence length, vocabulary and tone to the reading level, and asks for content suitable for minors. The author's idea is fenced, so instructions hidden in it are not followed.

## How a story becomes Ink

The LLM never writes Ink. It returns JSON that matches a zod schema (`shared/schema.ts`). The JSON is the source of truth, and a deterministic serializer (`client/src/lib/inkSerializer.ts`) turns it into Ink, which the official inkjs compiler compiles in the browser.

```ink
# title: Le phare qui murmure
# reading_level: 11-12

-> phare

=== phare ===
# scene: phare
# emoji: 🗼
# mood: mystere
Chaque soir, Lina allume la lanterne du vieux phare. …
+ [Monter au sommet #emoji: 🪜] -> sommet
+ [Descendre à la crique #emoji: 🏖️] -> crique

=== fin_lumiere ===
# scene: fin_lumiere
# emoji: ☀️
# mood: joie
# ending: A
# ending_label: La voix libérée
Lina pose le coquillage sur la vague. …
-> END
```

- Each scene is an Ink knot. Tags carry metadata: `scene` (for the reachability explorer), `emoji` and `mood` (for display), and `ending` and `ending_label` (for endings).
- Choices are persistent (`+`), so they are still there when the reader comes back to a scene.
- All text is escaped, so a story can never break Ink syntax. Every escaping rule is tested by a compile-and-play round trip.
- The Ink always compiles, even mid-edit: a choice with a missing target ends the story and gets a warning instead of a compile error.

The full example is in [`examples/le-phare.json`](examples/le-phare.json) and [`examples/le-phare.ink`](examples/le-phare.ink).

## How the app checks a story

Two independent checks. Neither one asks the LLM.

1. **Structure** ([`shared/validate.ts`](shared/validate.ts), runs on the JSON): valid and unique ids, no Ink reserved words, existing targets, exactly two endings (A and B), 4 to 6 narrative scenes, 2 to 3 choices each leading to different scenes, single emojis. It also searches the scene graph: every scene must be reachable from the start, and an ending must be reachable from every scene. The first real LLM answer passed every other check but had an unreachable ending, which is why this search exists. The server uses it to retry the LLM once, and the editor shows the issues as warnings.
2. **Reachability** ([`client/src/lib/explorer.ts`](client/src/lib/explorer.ts), runs on the compiled Ink): plays every path with inkjs. At each decision point it saves the state, tries each choice, and restores. A decision point already explored is skipped, which is what makes loops terminate, and a step budget is the safety net. It reports reached and unreached scenes, reached endings, dead ends and runtime errors. Because it plays the compiled Ink, it also works on imported `.ink` files.

## Design decisions so far

- **npm workspaces + a `shared/` folder** with a `@shared/*` alias, so the server and the client use the same validation code. This matters from step 4 onwards: the server retries the LLM when validation fails, and the editor uses the same rules to show warnings.
- **`tsx`** runs the TypeScript server directly, with no build step.
- **A Makefile** as a single entry point, with one npm script per target.
- **zod as the single definition of the data model**: types, runtime validation and the strict schema sent to OpenAI come from the same code.
- **The JSON is the source of truth, and Ink is an output format.** The structure is guaranteed by code, not by the LLM.

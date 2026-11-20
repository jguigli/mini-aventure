# Mini-aventure

A local web app to create short interactive adventures for readers aged 8 to 15, in the [Ink](https://www.inklestudios.com/ink/) format. An author types an idea, an LLM (OpenAI) drafts the story, and the author edits it on a visual map, plays it, checks that every scene and ending is reachable, and exports it as `.ink`.

> The app's interface and generated stories are in French. The code, its comments and its documentation are in English.

**Guiding principle: the LLM proposes, the code verifies, the author decides.**

## Status

Work in progress, built step by step (see [`docs/steps/`](docs/steps/)). Deviations from the original spec are listed in [`docs/03-deviations.md`](docs/03-deviations.md).

| Step | Content                                                                 | Status |
| ---- | ----------------------------------------------------------------------- | ------ |
| 1    | Project skeleton, health check, Makefile                                | ✅     |
| 2    | Ink core: zod schema, JSON → Ink serializer, compilation, example story | ✅     |
| 3    | Reachability explorer, structural validation, emoji checks              | ✅     |
| 4–10 | Generation, editor, reader, import/export, AI editing, polish           | ⏳     |

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

| Route             | Response                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `GET /api/health` | `{ "ok": true, "openaiKey": true \| false }` (reports whether a key is set, never the key itself) |

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

1. **Structure** ([`shared/validate.ts`](shared/validate.ts), runs on the JSON): valid and unique ids, no Ink reserved words, existing targets, exactly two endings (A and B), 4 to 6 narrative scenes, 2 to 3 choices each, single emojis. The server uses it to retry the LLM once, and the editor shows the issues as warnings.
2. **Reachability** ([`client/src/lib/explorer.ts`](client/src/lib/explorer.ts), runs on the compiled Ink): plays every path with inkjs. At each decision point it saves the state, tries each choice, and restores. A decision point already explored is skipped, which is what makes loops terminate, and a step budget is the safety net. It reports reached and unreached scenes, reached endings, dead ends and runtime errors. Because it plays the compiled Ink, it also works on imported `.ink` files.

## Design decisions so far

- **npm workspaces + a `shared/` folder** with a `@shared/*` alias, so the server and the client use the same validation code. This matters from step 4 onwards: the server retries the LLM when validation fails, and the editor uses the same rules to show warnings.
- **`tsx`** runs the TypeScript server directly, with no build step.
- **A Makefile** as a single entry point, with one npm script per target.
- **zod as the single definition of the data model**: types, runtime validation and the strict schema sent to OpenAI come from the same code.
- **The JSON is the source of truth, and Ink is an output format.** The structure is guaranteed by code, not by the LLM.

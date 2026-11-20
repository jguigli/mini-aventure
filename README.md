# Mini-aventure

A local web app to create short interactive adventures for readers aged 8 to 15, in the [Ink](https://www.inklestudios.com/ink/) format. An author types an idea, an LLM (OpenAI) drafts the story, and the author edits it on a visual map, plays it, checks that every scene and ending is reachable, and exports it as `.ink`.

> The app's interface and generated stories are in French. The code and its documentation are in English, except code comments, which are in French.

**Guiding principle: the LLM proposes, the code verifies, the author decides.**

## Status

Work in progress, built step by step (see [`docs/steps/`](docs/steps/)).

| Step | Content                                                                           | Status |
| ---- | --------------------------------------------------------------------------------- | ------ |
| 1    | Project skeleton, health check, Makefile                                          | ✅     |
| 2–10 | Ink core, explorer, generation, editor, reader, import/export, AI editing, polish | ⏳     |

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

## Design decisions so far

- **npm workspaces + a `shared/` folder** with a `@shared/*` alias, so the server and the client use the same validation code. This matters from step 4 onwards: the server retries the LLM when validation fails, and the editor uses the same rules to show warnings.
- **`tsx`** runs the TypeScript server directly, with no build step.
- **A Makefile** as a single entry point, with one npm script per target.

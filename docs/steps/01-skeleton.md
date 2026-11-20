# Step 1 — Project skeleton

## Goal

Set up the monorepo so that one command starts both the API and the client, prove that the client reaches the API through the Vite proxy, and prove that code in `shared/` can be imported from both sides.

## What was built and how it works

- **Monorepo with npm workspaces** (`client`, `server`, `shared`). A single `npm install` at the root installs everything, and dependencies are hoisted to the root `node_modules`.
- **`shared/` and the `@shared/*` alias.** `shared/api.ts` holds the API contract (`API_HEALTH_PATH`, `HealthResponse`, `ApiError`). It is imported by both the server and the client. The alias is declared in three places, which must stay in sync:
  - `client/tsconfig.json` and `server/tsconfig.json` (`paths`), for type-checking;
  - `client/vite.config.ts` (`resolve.alias`), for the browser bundle;
  - `vitest.config.ts`, for tests.

  On the server, `tsx` reads `paths` from `tsconfig.json` at runtime, so no extra tool is needed.
- **Server** (`server/src/index.ts`, `server/src/env.ts`): Express 5. `env.ts` loads `server/.env` with a path resolved from the file itself, so it works whichever directory the server is started from. `GET /api/health` returns `{ ok: true, openaiKey: boolean }`, which reports only whether a key is present. If the key is missing, the server logs `Clé manquante : renseigne server/.env` and keeps running. Unknown `/api/*` routes return a JSON 404 instead of Express's HTML page. `GET /` on port 3001 returns a short text pointing to the app on port 5173, because opening the API port by mistake used to show `Cannot GET /`.
- **Client** (`client/src/App.tsx`): a temporary screen that calls `/api/health` and shows one of three states: key configured, key missing, or API unreachable. The status line is `role="status"` / `aria-live="polite"`. This screen is replaced at step 5.
- **Vite proxy**: `/api` → `http://localhost:3001`. The browser only talks to the Vite origin, so there is no CORS to configure and the key never reaches the client.
- **Styles** (`client/src/styles.css`): global CSS variables (warm palette), visible focus ring, no UI framework.
- **Makefile**: `help` (default), `install`, `env`, `dev`, `test`, `lint`, `format`, `build`, `clean`. Each target calls one npm script. `make env` copies `.env.example` only when `server/.env` does not exist yet.

## Files

Created:
- `package.json`, `package-lock.json`, `Makefile`, `README.md`
- `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`
- `shared/package.json`, `shared/api.ts`
- `server/package.json`, `server/tsconfig.json`, `server/.env.example`, `server/src/env.ts`, `server/src/index.ts`
- `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`, `client/src/main.tsx`, `client/src/App.tsx`, `client/src/styles.css`
- `docs/steps/01-skeleton.md`

Modified:
- `.gitignore` (adds `*.log`, `.vite/`, `coverage/`)
- `CLAUDE.md` (Prettier only added blank lines under headings, no content change)

## Decisions and deviations from docs/02

- **Installed versions are recent majors**: TypeScript 6.0, Vite 8.3, Vitest 4.1, ESLint 10, Express 5.3, React 19.3, dotenv 18. All of them support Node 20.19+.
- **TypeScript 6 deprecates `baseUrl`.** `paths` is resolved relative to the `tsconfig.json` file, without `baseUrl`.
- **Server module resolution is `Bundler`**, not `NodeNext`. The server is only run through `tsx`, never compiled with `tsc`, so imports without `.js` extensions are fine. `tsc --noEmit` is used only for type-checking.
- **`npm test` uses `--passWithNoTests`**, because there are no tests yet (they arrive at step 2).
- **`zod` is not installed yet.** It arrives with the schemas at step 2.
- **`docs/` is in `.prettierignore`**, so Prettier does not reformat the design documents.

## Library docs checked

- **Engines** (`node_modules/*/package.json`): Vite 8 and ESLint 10 need Node `^20.19.0 || >=22.12.0`. The local Node is 20.20.0, which is OK. The requirement is noted in the README.
- **dotenv 18** (`node_modules/dotenv/dist/index.d.ts`): `config({ quiet: true })` is a supported option. It silences dotenv's startup log.
- **TypeScript 6**: `tsc` reported error TS5101 for `baseUrl` (deprecated, removed in TS 7). I removed the option.

## How to test

```bash
make install
make env        # creates server/.env if missing
make dev        # then open http://localhost:5173
make test       # passes (no tests yet)
make lint
make build
```

Checks already run:
- [x] `GET :3001/api/health` → `{"ok":true,"openaiKey":false}` with no key.
- [x] Same response through the proxy, `GET :5173/api/health`.
- [x] With `OPENAI_API_KEY` set → `{"ok":true,"openaiKey":true}`.
- [x] Unknown route → `{"error":"Route inconnue."}` (404).
- [x] The client bundle resolves `@shared/api` to `shared/api.ts`. The server imports it too, and type-checking passes on both sides.
- [x] `make lint`, `make build` and `make test` pass. `make env` does not overwrite an existing `server/.env`.
- [ ] **Manual**: paste your key into `server/.env`, run `make dev`, and check that the page shows « API OK, clé OpenAI configurée ».

## Known limitations

- At startup, Vite can log a single `http proxy error ... ECONNREFUSED` if the client is ready before the server. This is harmless: the page's request is retried on reload. A reload is enough if the page shows « API injoignable ».
- `OPENAI_MODEL` is still empty. The model is chosen at step 4.

## Git

```bash
git add .gitignore CLAUDE.md Makefile README.md package.json package-lock.json \
  eslint.config.js .prettierrc.json .prettierignore vitest.config.ts \
  shared/package.json shared/api.ts \
  server/package.json server/tsconfig.json server/.env.example server/src/env.ts server/src/index.ts \
  client/package.json client/tsconfig.json client/vite.config.ts client/index.html \
  client/src/main.tsx client/src/App.tsx client/src/styles.css \
  docs/steps/01-skeleton.md
git commit -m "chore: set up monorepo skeleton with health check and Makefile"
```

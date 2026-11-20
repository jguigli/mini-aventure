# Mini-aventure

A local web app to create short interactive adventures for readers aged 8 to 15, in the [Ink](https://www.inklestudios.com/ink/) format. An author types an idea, an LLM (OpenAI) drafts the story, and the author edits it on a visual map, plays it, checks that every scene and both endings are reachable, and exports it as `.ink`.

> The interface and the generated stories are in French. The code, its comments and this documentation are in English.

**Guiding principle: the LLM proposes, the code verifies, the author decides.**

<p align="center">
  <img src="docs/images/editor.png" alt="The map editor: scenes as coloured cards linked by arrows, the quick test path lit in orange, and the side panel with the AI rewrite actions" width="900">
  <br>
  <em>The editor: each scene is a card, each choice an arrow. The quick test lights up the path taken, and the side panel edits the selected scene or reworks it with the AI.</em>
</p>

<table>
  <tr>
    <td width="50%" align="center" valign="top">
      <img src="docs/images/create.png" alt="Creation screen: an idea field, three reading-level pills and the Generate button">
      <br>
      <strong>Create</strong><br>
      <em>An idea, a reading level (8-10, 11-12, 13-15), and the AI drafts the story. Or load the built-in example.</em>
    </td>
    <td width="50%" align="center" valign="top">
      <img src="docs/images/reader.png" alt="Reader: a big emoji, the scene title and text, and the choices as large numbered buttons">
      <br>
      <strong>Read</strong><br>
      <em>The Reader plays the compiled Ink: big emoji, text, choices as buttons (mouse or keys 1-9), both endings.</em>
    </td>
  </tr>
</table>

## Quick start

Requirements: **Node.js 20.19+** (or 22.12+) with npm 10+, `make` (preinstalled on macOS and Linux), and an OpenAI API key (only needed to generate or rewrite with the AI; everything else works without one).

```bash
make install   # install all dependencies (npm workspaces)
make env       # create server/.env from server/.env.example (never overwrites an existing file)
```

Open `server/.env` and paste your key:

```dotenv
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini   # any model that supports structured outputs
```

`server/.env` is ignored by git. The key is read by the server only and is never sent to the browser. `OPENAI_MODEL` sets the model for generation and rewrites (if empty, `gpt-5.4-mini`). It is read at startup, so restart `make dev` after changing it. The server logs the model in use: `API prête sur http://localhost:3001 (modèle : …)`.

```bash
make dev       # API on port 3001 + app on http://localhost:5173
```

Open **http://localhost:5173**. Without a key, the server still starts (it logs `Clé manquante : renseigne server/.env`) and the home screen says so. You can still load the examples, edit, play, import and export.

| Command                                  | What it does                               |
| ---------------------------------------- | ------------------------------------------ |
| `make help`                              | List the commands                          |
| `make install` / `make env` / `make dev` | Install, create `server/.env`, run         |
| `make test`                              | Unit tests (Vitest, 164 tests, no network) |
| `make lint` / `make format`              | ESLint / Prettier                          |
| `make build`                             | Type-check both apps and build the client  |
| `make clean`                             | Remove `node_modules` and build outputs    |

## Documentation

- [Project overview](docs/05-project-overview.md): 2-minute demo, features, architecture, API, design decisions, testing, how it was built with AI, limitations, example sources.
- [Deviations from the spec](docs/03-deviations.md): every difference with the original spec, and why.
- [Step-by-step docs](docs/steps/): what was built at each step, how it was tested, its limits.

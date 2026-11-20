# Personal Q&A: questions asked while testing and reviewing the project

These are the questions I asked while testing the finished app and checking that I understood it, kept as revision notes for the oral. The questions are quoted as asked (in French). Each answer reflects the state of the code **after** the fixes they led to.

---

## Testing the generated stories

### 1. « En lisant en mode lecture, ça commence directement par la première scène. Il nomme l'enfant Nora mais c'est pas explicite, comme si il manquait d'infos descriptives au début, qu'est-ce que t'en penses ? »

The cause was the prompt, not the Reader. Nothing asked for an introduction, so with only 2 or 3 sentences per scene (level 8-10) the model jumped straight into the action. The context existed only in `plan.summary`, which is never shown to the reader (and often reveals the endings).

**Fix:** a rule in the generation prompt (`server/src/prompts.ts`, section ÉCRITURE). The starting scene must be a real introduction: the hero's first name and an endearing detail, the place, and what starts the adventure, before the first choice. It may have one extra sentence.

**Result:** « Milo adore parler aux animaux. Son lapin en peluche, Nougat, l'écoute toujours. Aujourd'hui, il entre seul dans la forêt pour trouver des amis. Un geai bleu lui lance un bonjour très moqueur. » It is an introduction, in 4 sentences (3 + 1 allowed).

Considered and not done: an `intro` field and a cover page in Lecture.

### 2. « J'ai choisi "proposer un jeu" mais la suite c'est des écureuils qui écoutent une histoire. J'ai l'impression qu'OpenAI génère des histoires et les associe sans forcément donner du sens entre les choix et les scènes qui suivent. Peux-tu vérifier ? »

**Verified** with a real generation using the same idea. 3 of 6 scenes were the target of several choices, and each was written as the follow-up of **only one** of them (« Écouter les feuilles » → « Un écureuil saute près de l'eau. Il a perdu des noisettes… »).

**Cause:** the model writes a choice's label before the scene it leads to, and a scene shared by several paths cannot follow from all of them.

**Fix**, the idiomatic Ink answer to branching and joining:
- each choice now has an **`outcome`**, one sentence printed right after the click that leads into the next scene;
- the schema field order makes the model decide the target first;
- the prompt says a shared scene must not assume a specific choice;
- in Ink, the divert goes on its own line (otherwise inkjs glues the outcome to the next scene's first line);
- the Reader shows the outcome in italics above the next scene, and the editor has a « Ce qui se passe ensuite » field.

**Result:** 0 empty outcomes, and every path into a shared scene has its own transition.

**Limit:** coherence is asked of the model, not measured by code.

---

## Features and rules

### 3. « À quoi sert le verrouillage de scène ? »

A locked scene 🔒 is "finished, the AI does not touch it":
- the « ✨ Retravailler avec l'IA » controls are hidden;
- the server refuses a rewrite (409) without calling the model;
- the map and the scene list show 🔒.

It does not block manual editing, and it is not exported to the `.ink` (it is editor information).

Its current value is limited, because rewriting is already one scene at a time, with a preview and undo. It becomes really useful with features not built: « Changer d'idée » (regenerate what follows a scene, except locked scenes) and an AI coherence review with « Corriger avec l'IA ». For the oral: "the author controls what the AI is allowed to change".

### 4. « Dans le prompt, il est indiqué 4 à 6 scènes + 2 fins possibles ? »

Yes (`server/src/prompts.ts`, lines 50-52): 4 to 6 narrative scenes plus exactly 2 endings (A and B), and 2 to 3 choices per narrative scene. That is **6 to 8 scenes in total**. The numbers come from `LIMITS` in `shared/validate.ts`, the same constant the checks use, so the prompt and the validation cannot drift apart. After generation:
- the wrong number of endings is retried once, then **blocking** (the editor cannot create endings);
- the wrong number of scenes or choices is retried once, then returned **as a warning** (fixable in the editor).

### 5. « Pourquoi on ne peut pas supprimer la première scène puis les deux fins ? Est-ce lié au code ? »

Yes, on purpose. The editor can neither pick another start scene nor create an ending, so deleting one would leave a problem only Ctrl+Z could fix. One rule, `sceneRemovalBlocker` (`client/src/lib/storyEdits.ts`), protects the start scene and both endings in two places:
- the « Supprimer la scène » button is disabled, with the reason as its tooltip;
- `removeScene` itself refuses.

These scenes can still be **edited**. (The endings used to be deletable: that gap was found and fixed while answering this question.)

### 6. « Est-il possible de mettre le modèle utilisé dans le .env à OPENAI_MODEL ? »

Yes, it already worked. `server/src/env.ts` reads `OPENAI_MODEL` and falls back to `gpt-5.4-mini` only when it is empty. `server/.env.example` now shows `OPENAI_MODEL=gpt-5.4-mini` explicitly. The `.env` is read at startup, so restart `make dev` after changing it. The server logs the model in use (`API prête … (modèle : …)`).

---

## Prompts

### 7. « Le choix des 3 niveaux, c'est une partie du prompt qui change ou seulement la tranche d'âge envoyée dans le prompt pour référence au LLM ? »

A real **block of writing instructions per level**, not just the age range. `READING_LEVELS` (`server/src/prompts.ts`, line 9) holds three blocks, and the chosen one is inserted into the user message:

| | 8-10 (CM1-CM2) | 11-12 (6e-5e) | 13-15 (4e-3e) |
|---|---|---|---|
| Sentences | ≤ 12 words, one idea each | ≤ 18 words | Varied |
| Per scene | 2-3 sentences | 3-4 sentences | 4-5 sentences |
| Tone | Common words, humour, wonder | Richer words from context, light suspense | Richer vocabulary, real tension, moral dilemmas |
| Ending B | Failed but reassuring | (no specific rule) | Can be dark, but bittersweet |

The rewrite also receives the level's block, which is why « Adapter au niveau de lecture » works. The server then forces `readingLevel` to the requested value.

**Limit:** sentence length is asked for, not measured by code.

### 8. « Donc ça fait 1 prompt général + 3 sous-prompts liés aux tranches d'âge ? Dis-moi où se situent les prompts dans le code. »

Almost: one general **system prompt** plus **one of three instruction blocks**, inserted into a message template that is the same for every level. Almost everything is in **`server/src/prompts.ts`**:

| What | Where | Role |
|---|---|---|
| `READING_LEVELS` | line 9 | The 3 level blocks |
| `SYSTEM_PROMPT` | line 39 | General generation prompt (role, French, structure, outcomes, introduction, emojis, content for minors) |
| `buildGenerateInput` | line 87 | User message: level block + idea fenced in `<idee>` |
| `buildRetryInput` | line 106 | Retry message: the issues found by code + the scenes that really exist |
| `REWRITE_SYSTEM_PROMPT` | line 137 | System prompt for « Retravailler » |
| `buildRewriteInput` | line 156 | Level block + story context + scene as JSON (with each choice's target) + instruction fenced in `<consigne>` |

Elsewhere:
- the rewrite retry message is in `server/src/rewrite.ts`;
- the 4 quick-action instructions (`QUICK_ACTIONS`) are in `client/src/components/RewritePanel.tsx`.

`server/src/openai.ts` sends them: `callStructured` puts the system prompt in `instructions` and the messages in `input`.

```
Generation: SYSTEM_PROMPT + [level block + <idee>]                          (+ retry)
Rewrite:    REWRITE_SYSTEM_PROMPT + [level block + context + scene + <consigne>]
```

---

## Architecture

### 9. « Pour vérifier que j'ai bien tout compris » (client/server split)

What I had right:
- the client is the web UI;
- the server has the 3 routes (`/api/health`, `/api/generate`, `/api/rewrite`) and calls OpenAI, mainly so **the key never reaches the browser**;
- OpenAI's output goes through `validateStory()` and is retried once if needed;
- « Retravailler » uses `/api/rewrite`;
- Lecture and editing happen in the client.

What I had wrong:
- **The server is stateless: it keeps no story.** The source-of-truth JSON lives **in the browser** (`storyStore` in memory, autosaved to `localStorage`).
- **Manual edits make no API call.** They create a new JSON in the browser.
- **« Vérifier » is not only `validateStory()`.** It runs `analyzeStory` in the browser: `validateStory` (the same `shared/` code as the server) → Ink → inkjs compilation → explorer. No server call.
- **The `.ink` export is done by the client**, from the current JSON, at click time.

Nuances:
- the server's reachability check is a graph search on the JSON; the explorer that *plays* the Ink exists only in the client, because inkjs runs in the browser;
- if issues remain after the retry, fixable ones come back as **warnings**, the others as a **422**;
- for « Retravailler », the client sends the whole story, the server returns **proposals**, and the client applies the one I keep (with the original choice targets).

```
BROWSER (client)                                      SERVER (stateless)
storyStore = source-of-truth JSON                     keeps NO story
 ├─ manual editing (no network)
 ├─ undo, localStorage autosave
 ├─ validateStory + Ink + inkjs + explorer
 ├─ Lecture, import/export
 ├── POST /api/generate {idea, level} ─────────►  OpenAI → validateStory → retry?
 └── POST /api/rewrite {story, scene, instr.} ─►  OpenAI → check choices → retry?
```

One sentence for the oral: *the server is a stateless go-between that protects the key and checks what the AI returns; the story lives in the browser, where editing, checking, reading and exporting happen.*

### 10. « Quand je modifie les scènes sur l'éditeur, c'est le Ink qui est modifié en temps réel ou le JSON qui est ensuite recompilé en .ink ? »

**The JSON**, directly. The Ink is never edited nor stored. It is regenerated from the JSON by `storyToInk` (deterministic: same JSON, same Ink) whenever it is needed:

```
edit in the panel → storyStore.edit() → NEW JSON (old one goes to the undo history)
  ├─ immediately: map and panel redrawn from the JSON
  ├─ ~0.3 s later: JSON → Ink → inkjs → explorer (⚠️/✅ on the map)
  └─ ~0.5 s later: JSON saved to localStorage
```

The Reader, the exports and « Voir le code Ink » also serialize the current JSON when needed.

**The exception** is an imported `.ink`: there, the Ink **is** the source, edited as text and recompiled. That is why imports have no map.

**Why:** editing Ink directly would mean parsing and rewriting a programming language. The JSON makes every change a simple object that is easy to undo, check and draw.

### 11. « C'est quoi la différence entre JSON et JSON compilé ? »

Two unrelated formats, with the Ink in between:

```
app JSON ──storyToInk──► .ink (source) ──inkjs compiler──► compiled .json
```

| | App JSON | `.ink` | Compiled `.json` |
|---|---|---|---|
| What | **Our** data model: scenes, choices, targets, plan | Ink source code | Output of the Ink compiler (`story.ToJson()`) |
| Written by | The AI and the editor | Our serializer | inkjs |
| For | Our app | An author (Inky) | An ink runtime (inkjs, Unity plugin) |
| Readable | Yes | Yes | No (`"^text"`, `"ev"`, `{"*": …, "flg": 4}`) |
| Exported | No | Yes (main button) | Yes (« Autres formats ») |

Only their syntax is shared: our JSON describes the story with our concepts, while the compiled JSON describes the Ink **program** a runtime executes. A game loads the compiled `.json`, not the `.ink`.

### 12. « Pourquoi on ne peut pas faire de cartographie avec le format .ink mais on peut avec JSON ? »

The map needs an **explicit graph**: nodes (scenes) and arrows (choices to a known scene). **The JSON is that graph**: every `targetSceneId` is an arrow. **Ink is a programming language** where that graph often does not exist statically:
- **weave** has no knots (the Monsieur Fogg example has none: what would the nodes be?);
- **conditional choices** exist only in some states;
- **computed diverts** (`-> variable`) have a destination known only at runtime;
- **tunnels and threads** are calls with a return, not simple arrows;
- **stitches, functions and alternatives** add more levels of structure.

Mapping arbitrary Ink means statically analysing a language. **Editing from the map** is harder still: it means rewriting the author's Ink text in the right place without breaking it.

Honest nuances:
- the `.ink` **our app produces** could be mapped (we control its format); that is the "rebuild the JSON" work the spec leaves out of scope;
- an **approximate, read-only** map of any Ink could be drawn by *playing* it, as the explorer does, but it would be incomplete with variables.

For the oral: *JSON is a restricted format that is a graph by construction, so the map and visual editing are trivial. Ink is a full language, where arrows can depend on state. Hence: JSON as the source of truth, and imported .ink files in text mode.*

---

## Earlier, during the build

### 13. « L'export en .json compilé ? L'export doit sortir du .ink, est-ce ce que tu voulais dire ? »

Yes: the main export is the `.ink`. The « compiled .json » is not our app JSON. It is the `.ink` compiled by inkjs, the format ink runtimes load. It is offered as a secondary export in « Autres formats », as the spec asks. I chose to keep it.

### 14. « Comment éviter l'erreur de l'histoire 2 du choix qui mène à une autre scène inexistante ? »

Three options were proposed:
1. A more precise retry that lists the scenes that really exist.
2. Let the author fix the remaining issues in the editor instead of failing.
3. Make it impossible through the schema (an enum of scene ids, via two calls or imposed ids).

**Done: 1 and 2.**
- The retry message lists « les SEULES valeurs possibles pour targetSceneId ».
- After the retry, if every remaining issue is fixable in the editor, the story comes back **with warnings** (a banner and ⚠️ on the map) instead of a 422.
- Option 3 was judged too heavy for the 4-hour budget.

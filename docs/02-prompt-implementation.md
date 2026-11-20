# Prompt d'implémentation — « Mini-aventure à choix »

> **Mode d'emploi** : le `CLAUDE.md` à la racine renvoie à ce document, donc la partie A est déjà connue de Claude (inutile de la coller). Donne **une étape de la partie B à la fois** (« Fais l'étape 3 de docs/02 »). Après chaque étape, vérifie les critères d'acceptation, puis copie-colle les commandes `git add` et `git commit` que Claude te fournit (il ne versionne jamais à ta place) avant de passer à la suivante. Les étapes 1 à 8 forment le parcours minimal ; l'étape 9 contient les bonus et l'étape 10 la documentation.

---

# A. Contexte global (à coller en premier)

## Le projet
Construis une application web **locale** pour créer des mini-aventures interactives au format **Ink** (`.ink`, le langage narratif d'inkle).

Parcours utilisateur :
1. L'auteur saisit une **idée** et choisit un **niveau de lecture** pour un public de **8 à 15 ans** (*8-10 ans* / *11-12 ans* / *13-15 ans*).
2. Un **vrai appel LLM** (OpenAI) génère une aventure : **4 à 6 scènes narratives, plus 2 scènes de fin**, avec 2 à 3 choix par scène narrative.
3. L'auteur **édite** l'histoire sur une carte visuelle, la **joue** dans un lecteur épuré, et peut demander à l'IA de **retravailler** une scène.
4. L'application **vérifie** que toutes les scènes, tous les choix et les deux fins sont atteignables.
5. L'auteur **exporte** en `.ink` (et en `.json` compilé). Il peut aussi **importer** un `.ink` existant.

Contraintes : 4 h de travail en tout, simplicité, réutilisation de briques existantes. Code lisible et commenté aux endroits clés ; je dois pouvoir l'expliquer.

## Principe d'architecture (non négociable)
**Le LLM propose, le code vérifie, l'auteur décide.**
- Le LLM renvoie du **JSON structuré** (structured outputs avec un schéma JSON strict), **jamais de l'Ink brut**.
- Un **sérialiseur déterministe** convertit le JSON en Ink.
- **inkjs** compile l'Ink, et un **explorateur** vérifie l'atteignabilité en jouant tous les chemins.
- Dans l'éditeur, le **JSON est la source de vérité** ; l'Ink est dérivé de ce JSON à chaque modification.
- Toute modification venant de l'IA passe par un **aperçu** que l'auteur accepte ou refuse.

## Stack
- **Monorepo** simple avec npm workspaces : `client/` (Vite + React + TypeScript), `server/` (Node + Express + TypeScript, lancé avec `tsx watch`) et `shared/` (schémas, types et validation, utilisés des deux côtés). Une commande `npm run dev` à la racine lance les deux (avec `concurrently`).
- **`shared/` est importé via l'alias `@shared/*`**, déclaré dans les `tsconfig` du client et du serveur et dans `vite.config.ts`. C'est indispensable : `validateStory` sert au serveur (relance du LLM, étape 4) **et** au client (avertissements de l'éditeur, étape 6).
- **zod** : une seule définition du modèle de données, qui produit à la fois les types TypeScript (`z.infer`), la validation à l'exécution et le schéma JSON strict envoyé à OpenAI (via le helper zod du SDK `openai`). Vérifie la version de zod compatible avec la version installée du SDK `openai`.
- **inkjs** (version **2.2 ou plus**, nécessaire pour les tags sur les choix) : `Compiler` et `Story`, utilisés côté client. Vérifie dans la doc de l'installation le bon chemin d'import du compilateur (`inkjs/full` ou `inkjs/compiler/Compiler`).
- **React Flow** (`@xyflow/react`) pour la carte, avec des positions calculées par niveau (profondeur depuis la scène de départ). Pas de dagre.
- **SDK officiel `openai`** côté serveur. Le modèle se configure par la variable d'environnement `OPENAI_MODEL` : choisis un modèle léger qui gère les structured outputs, et vérifie dans la doc OpenAI actuelle la syntaxe exacte du helper zod (`zodResponseFormat` pour Chat Completions ou `zodTextFormat` pour l'API Responses) et la méthode `parse` associée.
- **Vitest** pour les tests unitaires du cœur (sérialiseur, explorateur).
- Style : CSS simple (fichier global avec variables CSS), sans framework UI lourd. Esthétique épurée, chaleureuse, qui donne envie.

## Langue
- Tout est **en français** : l'interface, les messages d'erreur, les prompts et les histoires générées.
- Même si l'auteur saisit son idée dans une autre langue, l'histoire est **toujours générée en français** (consigne explicite dans le prompt système).

## Clé API OpenAI et sécurité
- **J'ai déjà une clé API OpenAI prête** (budget limité à 30 $). Ne crée pas de compte et ne simule pas d'appel : prévois simplement l'emplacement où je la colle, puis utilise-la pour de **vrais appels**.
- Dès l'étape 1, crée `server/.env.example` avec `OPENAI_API_KEY=` et `OPENAI_MODEL=`, puis indique-moi la commande pour créer `server/.env` à partir de cet exemple. Je colle ma clé moi-même : ne me la demande jamais dans la conversation.
- Au démarrage, si `OPENAI_API_KEY` est absente, le serveur affiche un message clair (« Clé manquante : renseigne server/.env ») au lieu de planter.
- La clé est chargée avec `dotenv` côté serveur. Elle n'est **jamais** envoyée au client.
- Fournis `.env.example` et ajoute `.env` au `.gitignore`.
- Limite la taille des entrées (idée de 500 caractères au plus) et renvoie des erreurs propres côté client.

## Modèle de données (partagé client/serveur dans `shared/schema.ts`, en zod)
```ts
import { z } from "zod";

export const ReadingLevel = z.enum(["8-10", "11-12", "13-15"]);
export const Mood = z.enum(["calme", "mystere", "tension", "joie", "sombre"]);

export const Choice = z.object({
  id: z.string(),            // ex. "c1"
  label: z.string(),         // texte du bouton
  emoji: z.string(),         // un seul emoji
  targetSceneId: z.string(), // doit exister (vérifié par validateStory, pas par le schéma)
});

// Schéma envoyé au LLM : tous les champs sont obligatoires (exigence du mode strict).
export const LlmScene = z.object({
  id: z.string(),            // identifiant Ink valide : [a-z][a-z0-9_]*, hors mots réservés
  title: z.string(),
  emoji: z.string(),
  mood: Mood,
  text: z.string(),          // 2 à 5 phrases selon le niveau de lecture
  choices: z.array(Choice),  // vide si et seulement si c'est une fin
  ending: z.object({ kind: z.enum(["A", "B"]), label: z.string() }).nullable(), // → anyOf [objet, null]
});

export const LlmStory = z.object({
  plan: z.object({ summary: z.string(), endingA: z.string(), endingB: z.string() }), // PREMIER champ : le LLM planifie avant d'écrire
  title: z.string(),
  readingLevel: ReadingLevel,
  startSceneId: z.string(),
  scenes: z.array(LlmScene),
});

// Modèle de l'application : le LLM + les champs propres à l'éditeur.
export const Scene = LlmScene.extend({ locked: z.boolean().optional() }); // bonus : l'IA n'y touche plus
export const Story = LlmStory.extend({ scenes: z.array(Scene) });

export type Story = z.infer<typeof Story>;
export type Scene = z.infer<typeof Scene>;
export type Choice = z.infer<typeof Choice>;
```
- **Le schéma envoyé au LLM ne contient jamais `locked`** : le mode strict refuse les champs optionnels. Un champ facultatif côté LLM s'écrit `.nullable()`, jamais `.optional()`.
- **Les contraintes de cardinalité et de cohérence** (nombre de scènes, de choix, de fins, destinations existantes) ne sont **pas** dans le schéma : le mode strict ne les gère pas toutes de façon fiable. Elles sont vérifiées par `validateStory` (dans `shared/validate.ts`), qui déclenche une relance si besoin.
- Le même schéma `Story` sert à valider une sauvegarde `localStorage` relue et le fichier `examples/le-phare.json`.

## Format Ink généré (référence)
```ink
// Titre : Le phare qui murmure
-> phare

=== phare ===
# scene: phare
# emoji: 🗼
# mood: mystere
La gardienne entend une voix monter de la mer.
+ [Monter l'escalier] # emoji: 🪜
  -> escalier
+ [Descendre à la crique] # emoji: 🌊
  -> crique

=== fin_lumiere ===
# scene: fin_lumiere
# emoji: ☀️
# ending: A
Le phare brille à nouveau.
-> END
```
- Utilise des **choix persistants `+`**, pas `*`, pour qu'ils ne disparaissent pas quand on revient sur une scène.
- Les tags `# scene:` servent à l'explorateur ; `# emoji:` et `# mood:` servent à l'affichage.
- Les tags sur les choix (`choice.tags`) demandent une version récente d'inkjs : vérifie-le, sinon garde les emojis des choix uniquement dans le JSON.
- **Identifiants de scène** : `[a-z][a-z0-9_]*`, et jamais un mot réservé d'Ink (`end`, `done`, `not`, `and`, `or`, `true`, `false`, `else`, `function`, `return`, `var`, `const`, `temp`, `list`, `include`, `external`). La liste est dans `shared/validate.ts` et rappelée dans le prompt système.
- **Échappement** : antislash devant `[`, `]`, `#`, `{`, `}`, `|`, `\` et devant les séquences `->`, `<-`, `<>`, `//`, `/*`. Une ligne de texte qui commence par `*`, `+`, `-`, `=` ou `~` est aussi échappée (sinon Ink la lit comme un choix, un gather, un knot ou du code). Le texte d'une scène est écrit ligne par ligne, sans ligne vide parasite.
- **Destination manquante** : un choix sans destination ou vers une scène qui n'existe plus est sérialisé en `-> END` (avec un commentaire `// destination manquante`), pour que l'Ink compile toujours pendant l'édition. `validateStory` signale le problème.

## Arborescence cible
```
/
├─ package.json            (workspaces, scripts dev / test)
├─ shared/
│  ├─ schema.ts            (schémas zod, types dérivés)
│  ├─ validate.ts          (validateStory, mots réservés Ink)
│  └─ emoji.ts             (validation et remplacement des emojis)
├─ server/
│  ├─ src/index.ts         (Express, routes /api/*)
│  ├─ src/openai.ts        (client et appels, relance)
│  ├─ src/prompts.ts       (prompts système)
│  ├─ .env.example
│  └─ .env                 (déjà créé, vide, ignoré par git)
├─ client/
│  ├─ src/lib/inkSerializer.ts
│  ├─ src/lib/inkCompile.ts
│  ├─ src/lib/explorer.ts
│  ├─ src/lib/layout.ts
│  ├─ src/state/storyStore.ts   (état et historique d'annulation)
│  ├─ src/screens/Create.tsx
│  ├─ src/screens/Editor.tsx
│  ├─ src/screens/Reader.tsx
│  └─ src/components/...
├─ examples/
│  ├─ le-phare.json / le-phare.ink   (exemple maison)
│  └─ (un .ink public, avec sa source citée)
└─ README.md
```

## Règles de travail
- Avance **étape par étape** ; ne commence pas l'étape suivante sans que je le demande.
- À la fin de chaque étape : liste des fichiers créés ou modifiés, commandes pour tester, limites connues.
- **Git : tu ne lances jamais `git add`, `git commit` ni `git push` toi-même.** C'est moi qui versionne. À la fin de chaque étape, écris-moi un bloc de commandes prêt à copier-coller, avec des chemins explicites (pas de `git add .`, pour ne jamais embarquer `.env` par erreur) et un message de commit clair au format *Conventional Commits*, par exemple :
  ```bash
  git add shared/types.ts client/src/lib/inkSerializer.ts client/src/lib/inkSerializer.test.ts
  git commit -m "feat(ink): sérialiseur JSON vers Ink et tests"
  ```
  Avant ce bloc, rappelle-moi de vérifier les critères d'acceptation de l'étape.
- Garde les fonctions du cœur **pures et testées** (sérialiseur, explorateur, layout).
- Si un point de la doc d'une bibliothèque est incertain, vérifie-le plutôt que de deviner, et signale-le.
- **Un `README.md` à la racine est obligatoire.** Crée-le dès l'étape 1 (installation, configuration de la clé, lancement), complète-le à chaque étape (fonctionnalités, arbitrages, limites), puis finalise-le à l'étape 10.

---

# B. Étapes de mise en place

## Étape 1 — Squelette du projet
- Le dépôt git est déjà initialisé, avec un `.gitignore` minimal (`node_modules/`, `dist/`, `.env`) et un `server/.env` vide. Complète le `.gitignore` si besoin, sans retirer `.env`.
- Crée le monorepo (npm workspaces), les deux applications, `shared/` avec l'alias `@shared/*`, les scripts `dev` et `test`.
- Un serveur Express avec `GET /api/health` ; le client affiche le résultat de ce test via le proxy Vite.
- `server/.env.example`, `.gitignore` (avec `.env`), ESLint et Prettier minimaux.
- Premier `README.md` : prérequis, `npm install`, **configuration de ma clé OpenAI** (copier `.env.example` vers `.env` et y coller la clé), `npm run dev`.
- `GET /api/health` indique aussi si la clé est configurée (`{ ok: true, openaiKey: true|false }`), sans jamais l'afficher.

**Acceptation** : `npm install && npm run dev` lance les deux ; un fichier de `shared/` est importé avec succès côté client et côté serveur ; une fois ma clé collée dans `server/.env`, la page affiche « API OK, clé OpenAI configurée ».

## Étape 2 — Cœur Ink : sérialiseur, compilation et exemple
- `shared/schema.ts` : les schémas zod du modèle de données.
- `inkSerializer.ts` : `storyToInk(story: Story): string`, au format de référence ci-dessus, avec les règles d'**échappement** et de **destination manquante** décrites plus haut.
- `inkCompile.ts` : `compileInk(source)` qui renvoie `{ story, errors, warnings }` avec le `Compiler` d'inkjs. **Ne lève jamais d'exception** : une erreur de compilation est renvoyée dans `errors`, pour que l'éditeur ne plante pas.
- `examples/le-phare.json` : une histoire de 5 scènes et 2 fins (thème : une gardienne de phare entend une voix venue de la mer). Elle passe `Story.parse`.
- Tests Vitest : l'exemple se sérialise et compile sans erreur ; chaque règle d'échappement est testée (y compris une ligne qui commence par `-` ou `*`) ; un choix sans destination produit un Ink qui compile.

**Acceptation** : `npm test` passe ; le `.ink` généré pour l'exemple s'ouvre aussi sans erreur dans Inky (vérification manuelle facultative).

## Étape 3 — Explorateur d'atteignabilité
- `explorer.ts` : `explore(story: InkStory, opts)` qui renvoie :
  ```ts
  { reachedScenes: Set<string>; reachedEndings: Set<string>;
    deadEnds: string[]; unreachedScenes: string[]; truncated: boolean }
  ```
- Algorithme : un parcours en profondeur. Avance avec `Continue()`, note les tags `scene:` et `ending:`, puis pour chaque choix : sauvegarde l'état (`state.ToJson()`), choisis, explore, restaure (`state.LoadJson()`). Fixe une limite (`maxSteps`) et mets `truncated` à vrai si elle est atteinte.
- **Détection des boucles** : ne compare **pas** les `state.ToJson()` entre eux. Ils contiennent les compteurs de visite et de tours, qui changent à chaque passage : deux passages par la même scène ne sont jamais égaux, et une boucle tournerait jusqu'à `maxSteps`.
  - Histoire générée (pas de variables, donc le comportement d'une scène ne dépend que de la scène) : un ensemble des tags `scene:` déjà explorés suffit. Une scène déjà vue n'est pas réexplorée.
  - `.ink` importé (sans tags `scene:`) : la clé d'état est `currentPathString` + le texte des choix proposés. `maxSteps` sert de filet de sécurité, car un `.ink` avec variables peut produire des états réellement différents au même endroit.
- Une impasse est une scène sans choix qui n'a pas de tag `ending`.
- Pour un `.ink` importé, dégrade proprement : une fin est identifiée par le dernier chemin atteint avant la fin de l'histoire (`currentPathString` avant le dernier `Continue()`) ; fins atteintes = nombre de chemins de fin distincts ; liste des impasses (histoire terminée par `DONE` sans fin claire, ou erreur d'exécution).
- `validateStory(story: Story)` dans **`shared/validate.ts`** : vérifications **structurelles** sur le JSON, qui renvoient une liste d'erreurs précises en français (`{ sceneId?, choiceId?, message }`) :
  - identifiants de scène et de choix uniques, au bon format, hors mots réservés d'Ink ;
  - `startSceneId` existe ; toutes les destinations existent (sinon « destination manquante ») ;
  - exactement 2 fins, une A et une B ; une fin n'a pas de choix et une scène sans choix est une fin ;
  - 4 à 6 scènes narratives, 2 à 3 choix par scène narrative ;
  - emojis valides (via `shared/emoji.ts`).
- Tests : l'exemple passe à 100 % ; une version modifiée avec une scène orpheline et une impasse est bien détectée ; **une histoire avec une boucle (un choix qui revient à une scène précédente) se termine sans `truncated`** ; un choix vers une scène supprimée est signalé.

**Acceptation** : tests verts ; les deux cas d'erreur sont signalés précisément.

## Étape 4 — Génération via OpenAI
- `POST /api/generate` `{ idea, readingLevel }` renvoie `Story`.
- Structured outputs avec le schéma zod **`LlmStory`** converti par le helper zod du SDK `openai` (qui produit `strict: true` et `additionalProperties: false`). **`plan` est le premier champ** du schéma, pour que le modèle planifie avant d'écrire. Vérifie dans la doc que la conversion produit bien un `anyOf` pour `ending` et gère un refus du modèle (`refusal`).
- Prompt système (en français) : rôle d'auteur de fiction interactive **jeunesse** ; contraintes de structure ; consignes par niveau de lecture (voir le tableau ci-dessous) ; des **fins vraiment distinctes** ; des choix qui ont une conséquence ; **emojis** concrets (un objet ou un lieu, pas une émotion), un seul par champ, sans répétition ; identifiants en `snake_case` ASCII.
- Niveaux de lecture (public de 8 à 15 ans), à mettre dans `prompts.ts` :

  | Niveau | Classes | Phrases | Texte par scène | Vocabulaire et ton |
  |---|---|---|---|---|
  | `8-10` | CM1-CM2 | courtes, 12 mots au plus, une idée par phrase | 2 à 3 phrases | Mots courants ; enjeux clairs ; humour et merveilleux ; fin « sombre » = fin ratée mais rassurante |
  | `11-12` | 6e-5e | 18 mots au plus | 3 à 4 phrases | Quelques mots plus riches, compréhensibles grâce au contexte ; suspense léger ; choix aux conséquences visibles |
  | `13-15` | 4e-3e | longueur variée | 4 à 5 phrases | Vocabulaire plus riche ; vraie tension ; dilemmes moraux ; fin sombre possible, douce-amère |

  Pour **tous** les niveaux : contenu adapté à des mineurs, pas de violence explicite ni de contenu effrayant traumatisant, pas de romance au-delà de l'amitié ou d'un simple béguin, et des libellés de choix courts (8 mots au plus).
- Validation de la requête avec zod (`idea` : 1 à 500 caractères ; `readingLevel` : l'enum), erreur 400 en français sinon.
- Côté serveur, après la réponse : normalisation des emojis, puis `validateStory` (importé de `shared/`). Si la validation échoue, **une seule** relance en renvoyant les erreurs au modèle. Si ça échoue encore, renvoie une erreur claire.
- Emojis (`shared/emoji.ts`) : garde le premier graphème (avec `Intl.Segmenter`, pour ne pas couper un emoji composé), vérifie qu'il correspond à `/\p{Extended_Pictographic}/u`, et remplace-le par 📖 sinon. Cette correction est silencieuse et ne déclenche pas de relance.
- Timeout de l'appel OpenAI (environ 60 s). Les erreurs (clé absente, quota, timeout, refus) sont renvoyées en `{ error: string }` en français, avec un code HTTP adapté.
- Journalise la durée et les tokens utilisés (pour suivre le budget).
- **Budget** : un seul `curl` réel pour valider l'étape ; le reste du développement se fait avec `examples/le-phare.json`.

**Acceptation** : un `curl` sur `/api/generate` renvoie une histoire valide, qui se sérialise, compile et passe l'explorateur à 100 %.

## Étape 5 — Écran de création
- Écran centré, chaleureux : titre de l'application, un grand champ « Ton idée » avec un placeholder inspirant, 3 pastilles de niveau de lecture, *8-10 ans* / *11-12 ans* / *13-15 ans*, avec les classes en sous-titre (accessibles au clavier, `role="radiogroup"`, *11-12 ans* sélectionné par défaut), et le bouton « Générer l'aventure ».
- Un état de chargement soigné (petite animation et des messages qui changent). Erreurs affichées dans la page, avec « Réessayer ».
- Un lien « Charger l'exemple » (`le-phare.json`) et « Importer un .ink » (désactivé jusqu'à l'étape 8).
- `storyStore.ts` : l'histoire courante et une **pile d'annulation** (copies du JSON, avec Ctrl+Z et Ctrl+Shift+Z), limitée à environ 50 entrées.
  - **Raccourcis** : l'app intercepte Ctrl+Z et Ctrl+Shift+Z (et Cmd sur macOS) **seulement si le focus n'est pas dans un `input` ou un `textarea`**. Dans un champ, on laisse l'annulation native du navigateur.
  - **Regroupement** : les frappes successives dans un même champ produisent **une seule** entrée d'historique (on la crée au premier changement après la prise de focus, ou après environ 1 s d'inactivité). Les actions discrètes (ajouter ou supprimer un choix ou une scène, changer une destination, « Garder » une proposition de l'IA) créent chacune une entrée.
- **Sauvegarde automatique** dans le `localStorage` :
  - L'histoire courante est enregistrée à chaque modification (avec un délai d'environ 500 ms), dans une clé versionnée (`mini-aventure:v1`). Ne sauvegarde pas la pile d'annulation.
  - Au chargement de l'application, si une sauvegarde existe, l'écran de création affiche « Reprendre ton aventure : *titre* » avec deux boutons, « Reprendre » et « Nouvelle histoire » (qui efface la sauvegarde).
  - Lectures et écritures dans des `try/catch`, et la sauvegarde relue est validée avec `Story.safeParse` : une sauvegarde corrompue ou un stockage indisponible ne doit jamais faire planter l'application.
  - Un petit indicateur discret « Enregistré » dans l'interface après chaque sauvegarde.

**Acceptation** : idée saisie, histoire générée, passage à l'écran suivant ; l'exemple se charge sans appel à l'API ; après un rafraîchissement de la page, je peux reprendre mon histoire avec mes modifications.

## Étape 6 — Mode Édition (carte et panneau)
- En-tête commun : titre (modifiable), **bascule Édition/Lecture**, « Vérifier ».
- **Barre d'actions en bas de l'écran**, commune et toujours visible **en Édition comme en Lecture**, avec un bouton bien visible « ⬇ Exporter le .ink », qui télécharge le fichier `<titre-en-slug>.ink` sérialisé depuis le JSON courant. L'indicateur « Enregistré » s'affiche aussi dans cette barre. Les autres formats d'export arrivent à l'étape 8.
- `layout.ts` : positions par niveau (parcours en largeur depuis la scène de départ ; les fins dans la dernière colonne ; les scènes inaccessibles dans une colonne à part).
- Carte React Flow : nœuds personnalisés (emoji, titre, couleur selon l'ambiance ; fins A et B avec des couleurs distinctes) ; une flèche par choix ; les scènes inaccessibles grisées et en pointillés ; ⚠️ sur les impasses.
- **Test rapide sur la carte** : la scène courante est mise en avant, ses choix apparaissent en boutons sous la carte ou dans le panneau, un clic avance et allume le chemin parcouru, et « Réinitialiser » remet à zéro.
- **Panneau latéral** pour la scène sélectionnée : titre, emoji, ambiance, texte (textarea qui s'agrandit), liste des choix (libellé, emoji, liste déroulante de destination, supprimer), « + Ajouter un choix », « + Nouvelle scène », « Supprimer la scène », « ▶ Jouer depuis ici ».
- **Règles d'édition** :
  - « + Nouvelle scène » crée un identifiant dérivé du titre (slug ASCII, mots réservés évités, suffixe `_2`, `_3`… si déjà pris). **L'identifiant n'est pas modifiable** dans l'interface (seul le titre l'est), pour ne pas casser les destinations.
  - « + Ajouter un choix » crée un choix sans destination : il est signalé « destination manquante » jusqu'à ce que l'auteur en choisisse une.
  - « Supprimer la scène » demande confirmation, interdit la suppression de la scène de départ, et **laisse les choix entrants en place** avec l'avertissement « destination manquante » (l'auteur décide comment les rediriger ; Ctrl+Z restaure la scène).
- À chaque modification : `validateStory`, sérialisation, compilation, exploration (avec un délai d'environ 300 ms), puis mise à jour des avertissements. Les problèmes **avertissent sans bloquer**, et un Ink qui ne compile pas affiche ses erreurs sans faire planter l'éditeur (la carte reste construite à partir du JSON).

**Acceptation** : je modifie un texte, je redirige un choix, la carte se recolore et une fin devenue inaccessible est signalée ; Ctrl+Z annule ; « Exporter le .ink » télécharge un fichier qui contient ma modification.

## Étape 7 — Mode Lecture
- Plein écran épuré : grand emoji de la scène, titre, texte (avec `aria-live="polite"`), choix en gros boutons avec leur emoji (`aria-hidden` sur l'emoji).
- Le lecteur utilise **la vraie Story inkjs** compilée (pas le JSON), ce qui prouve que l'Ink exporté fonctionne.
- Démarrage possible à une scène donnée (pour « Jouer depuis ici » : `ChoosePathString(sceneId)`).
- En fin de partie : le libellé de la fin, « Rejouer », et le compteur « Fins découvertes : x/2 » (gardé en mémoire pendant la session).
- Un discret « ✏️ Modifier cette scène » renvoie à l'Édition avec la scène sélectionnée.
- Navigation complète au clavier, focus visible.
- La **barre d'actions du bas** (avec « ⬇ Exporter le .ink ») reste visible, dans un style discret qui ne gêne pas la lecture.

**Acceptation** : je joue les deux fins depuis Lecture ; les allers-retours avec Édition conservent la scène ; j'exporte le `.ink` depuis Lecture.

## Étape 8 — Import et export
- **Export** : compléter la barre du bas. Le bouton principal reste « ⬇ Exporter le .ink » ; à côté, un petit menu avec « Exporter le .json compilé » (`story.ToJson()` d'inkjs) et « Voir le code Ink » (fenêtre avec bouton Copier).
- **Import `.ink`** : compilation, puis ouverture dans un **mode texte** (éditeur de texte simple et lecteur côte à côte, avec résultats de l'explorateur). Pas de carte pour les fichiers importés (choix assumé, à documenter).
  - Le `.ink` importé vit dans son **propre état** (le texte source), séparé du JSON `Story`. Il n'est pas sauvegardé dans `mini-aventure:v1` et n'utilise pas la pile d'annulation de l'éditeur (le textarea a la sienne).
  - Le compteur de fins du lecteur devient « Fins découvertes : x/N », où N est le nombre de fins trouvées par l'explorateur.
  - Si l'import a été produit par l'application (tags `# scene:` présents), on peut se contenter du mode texte : la reconstruction du JSON reste hors périmètre.
- Ajoute dans `examples/` un `.ink` public (par exemple un exemple de la documentation officielle d'inkle « Writing with Ink » ou du dépôt `inkle/ink`), **avec l'URL de la source et la licence** dans un en-tête de commentaire et dans le README.

**Acceptation** : export puis réimport de l'exemple maison sans erreur ; l'exemple public s'importe, se joue, et l'explorateur affiche ses résultats.

## Étape 9 — IA d'édition et bonus (par ordre de priorité)
1. **✨ Retravailler une scène** (priorité haute) : `POST /api/rewrite` `{ story, sceneId, instruction }` renvoie `{ scene }` (structured outputs avec le schéma zod `LlmScene` ; `locked` est recopié côté serveur). Actions rapides : *Améliorer le style*, *Plus court*, *Plus de suspense*, *Adapter au niveau de lecture*, plus une consigne libre. Le serveur vérifie que les destinations des choix sont **inchangées** et refuse une scène `locked`. Le client montre un **aperçu avant/après** avec « Garder » ou « Annuler » ; « Garder » ajoute une entrée dans la pile d'annulation.
2. **Vérifier la cohérence** : `POST /api/review` `{ story }` renvoie `{ issues: [{ sceneId, severity, problem, suggestion }] }`. Les problèmes s'affichent en ⚠️ sur la carte, avec « Corriger avec l'IA » qui appelle `/api/rewrite` en donnant la suggestion comme consigne.
3. **3 variantes** : `/api/rewrite` avec `variants: 3` ; l'auteur choisit parmi trois cartes.
4. **Verrouiller une scène** 🔒.
5. **Changer d'idée** à partir d'une scène : régénère la suite (avertissement « remplace les scènes suivantes »), puis nouvelle validation complète.

**Acceptation** (point 1 au minimum) : je retravaille une scène, je vois l'aperçu, je garde, puis Ctrl+Z restaure la version précédente.

## Étape 10 — Finitions et documentation
- Passe d'accessibilité : contrastes, focus, libellés `aria`, navigation au clavier sur la carte (au minimum : liste des scènes navigable en alternative à la carte).
- Le **README** contient :
  - Installation et lancement (`.env`, `npm run dev`), parcours de démonstration en 2 minutes.
  - Un schéma d'architecture (flux idée → LLM → JSON → Ink → inkjs → explorateur).
  - Les **arbitrages et compromis** (JSON plutôt qu'Ink généré, JSON comme source de vérité, zod comme définition unique du schéma, import en mode texte, emojis plutôt qu'images, vérification par le code plutôt que par le LLM).
  - Ce qui a été fait avec l'IA et ce qui a été relu ou corrigé à la main.
  - Les limites connues et les pistes suivantes.
  - Les sources des exemples.

**Acceptation** : un tiers clone le dépôt, ajoute sa clé et réalise le parcours complet avec le README seul.

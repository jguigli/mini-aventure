# CLAUDE.md — Mini-aventure à choix

Application web locale : une idée → un LLM (OpenAI) génère une mini-aventure → l'auteur l'édite sur une carte, la joue, l'exporte en `.ink`. Exercice d'entretien technique, **4 h au total**.

**Spécification de référence : [docs/02-prompt-implementation.md](docs/02-prompt-implementation.md).** Relis la partie A et l'étape en cours avant de coder. `docs/01-recap-cadrage.md` est un récap personnel : ne pas s'en servir comme spec (en cas de divergence, la 02 fait foi).

## Principe non négociable
**Le LLM propose, le code vérifie, l'auteur décide.**
- Le LLM renvoie du JSON (structured outputs, schéma strict), jamais d'Ink.
- Le JSON `Story` est la source de vérité ; l'Ink en est dérivé par un sérialiseur déterministe.
- La structure est vérifiée par le code (`validateStory` + explorateur inkjs), jamais par le LLM.
- Toute proposition de l'IA passe par un aperçu accepter/refuser, et « Garder » est annulable.

## Stack
- Monorepo npm workspaces : `client/` (Vite + React + TS), `server/` (Express + TS, lancé avec `tsx`), `shared/` (schémas zod, validation, emojis) importé via l'alias `@shared/*`.
- **zod** = définition unique du modèle : types (`z.infer`), validation à l'exécution et schéma strict OpenAI (helper zod du SDK).
- `inkjs` ≥ 2.2 (Compiler + Story, côté client), `@xyflow/react`, SDK `openai`, `dotenv`, Vitest, `concurrently`.
- CSS global avec variables, aucun framework UI. Pas de dagre, pas de lib de state (un store maison suffit).

## Commandes
> À compléter dès l'étape 1, puis tenir à jour.
- `npm install` — installe tous les workspaces
- `npm run dev` — client + serveur (concurrently)
- `npm test` — Vitest (cœur : sérialiseur, explorateur, layout, validation)
- `cp server/.env.example server/.env` — puis l'utilisateur colle sa clé lui-même

## Règles de travail
- **Une étape à la fois.** Ne commence pas l'étape suivante sans demande explicite.
- Fin d'étape : fichiers créés/modifiés, commandes de test, limites connues, rappel de vérifier les critères d'acceptation, puis un bloc `git add <chemins explicites>` + `git commit -m "<type>(<scope>): ..."` (Conventional Commits, message en français).
- **Git : ne jamais lancer `git add`, `git commit`, `git push`** (ni `git add .` dans les blocs proposés). L'utilisateur versionne lui-même.
- **Secrets** : ne jamais lire, afficher ni demander le contenu de `.env`. La clé ne quitte jamais le serveur. `/api/health` dit seulement si elle est présente.
- Appels OpenAI réels et payants (budget 30 $) : ne pas lancer de génération en boucle pour « tester » ; un seul `curl` de vérification par étape suffit, et privilégier `examples/le-phare.json` pour le reste.
- Doc de bibliothèque incertaine (import du compilateur inkjs, tags de choix, syntaxe structured outputs OpenAI, mots-clés du schéma strict supportés) : **vérifier dans la doc ou `node_modules`, ne pas deviner**, et le signaler.
- Mettre à jour `README.md` à chaque étape.

## Conventions de code
- Identifiants et noms de fichiers en anglais ; **commentaires, UI, messages d'erreur, prompts et histoires en français**.
- Commenter les endroits clés (sérialiseur, explorateur, prompts, schéma, retry) : l'utilisateur doit pouvoir tout expliquer à l'oral. Pas de commentaires décoratifs.
- Fonctions du cœur **pures et testées** : `storyToInk`, `explore`, `computeLayout`, `validateStory`.
- Code simple et lisible plutôt qu'abstrait : pas de couches génériques « pour plus tard ».
- TypeScript strict, pas de `any` sans justification.

## Pièges connus (le détail est dans la doc 02)
- `validateStory` est dans `shared/` : serveur **et** client s'en servent.
- Schéma envoyé au LLM (`LlmStory`) : pas de champ optionnel (`.nullable()`, jamais `.optional()`), pas de `locked`. La cardinalité est vérifiée par `validateStory` + une relance.
- Explorateur : ne jamais dédoublonner sur `state.ToJson()` (les compteurs de visite changent à chaque passage, donc aucune boucle n'est détectée).
- Sérialiseur et compilation ne doivent jamais faire planter l'éditeur : une destination manquante devient `-> END`, une erreur de compilation est affichée.
- Échappement Ink et mots réservés d'Ink pour les identifiants de scène : testés unitairement.
- Ctrl+Z de l'app inactif dans les `input`/`textarea` ; frappes regroupées en une entrée d'historique.

## Arborescence
Voir la doc 02, partie A (« Arborescence cible »).

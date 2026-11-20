# Mini-aventure à choix — Récapitulatif du cadrage

> Brief : un auteur saisit une idée, un LLM génère une aventure de 4 à 6 scènes avec des choix et deux fins. L'auteur la joue, la modifie, l'exporte. On vérifie que tous les choix et toutes les fins sont atteignables. Format Ink (`.ink`) en entrée et en sortie. 4 h maximum, documentation comprise, fonctionnement local.

---

## 1. Principe directeur

**Le LLM propose, le code vérifie, l'auteur décide.**

- Le LLM produit du **JSON structuré** (pas de l'Ink brut).
- Du **code déterministe** convertit ce JSON en `.ink`.
- Le **compilateur officiel** (inkjs) et un **explorateur automatique** vérifient le résultat.
- Toute proposition de l'IA s'affiche en **aperçu** : l'auteur accepte ou refuse.

---

## 2. Architecture

```
[Idée + niveau de lecture]
        │
        ▼
 Backend Express ──► OpenAI (structured outputs, schéma JSON imposé)
        │
        ▼
 JSON de l'histoire  ◄── source de vérité dans l'éditeur
        │  sérialiseur maison (déterministe)
        ▼
 Texte .ink ──► inkjs Compiler ──► Story jouable
        │                              │
        ▼                              ▼
   Export .ink / .json        Explorateur de chemins
                              (scènes atteintes, impasses, fins)
```

| Brique | Choix | Pourquoi / compromis |
|---|---|---|
| Front | Vite + React + TypeScript | Démarrage rapide, écosystème riche |
| Backend | Petit serveur Express | Uniquement pour garder la clé OpenAI côté serveur |
| Ink | **inkjs** (moteur + compilateur, version 2.1 et plus) | Compilation et lecture dans le navigateur, pas d'inklecate à installer |
| Carte | **React Flow**, positions calculées par niveau | Nœuds cliquables et zoom fournis ; une disposition par colonnes suffit pour 6 à 8 scènes, donc pas de dagre |
| LLM | OpenAI, modèle léger, structured outputs | Fiable et peu coûteux (le budget de 30 $ couvre des centaines de générations) |

---

## 3. Arbitrages clés

| Décision | Alternative écartée | Compromis accepté |
|---|---|---|
| Le LLM génère du **JSON**, que le code convertit en Ink | Le LLM écrit l'Ink directement | Structure garantie et zéro erreur de syntaxe. En contrepartie, pas de variables ni de conditions Ink, ce qui est acceptable pour une mini-aventure |
| **JSON = source de vérité** dans l'éditeur, Ink = format de sortie | Ink comme seule source de vérité | Édition visuelle possible. En contrepartie, un `.ink` importé s'ouvre en **mode texte et lecture**, sans carte (retrouver la structure d'un Ink quelconque est un vrai chantier) |
| Vérification **en jouant l'histoire** (explorateur inkjs) | Analyse statique du texte | Fonctionne aussi pour les `.ink` importés. Il faut une limite de profondeur et une détection des boucles |
| La structure est vérifiée **par le code**, jamais par le LLM | Demander au LLM « vérifie que tout est accessible » | Un LLM peut se tromper avec assurance. Le code fait foi |
| **Emojis** générés par le LLM pour illustrer | Images générées (API images) | Gratuit, instantané, modifiable. Le rendu varie selon le système. Les vraies images restent un bonus à la demande |
| Emojis stockés en **tags Ink** (`# emoji: 🌊`) | Emoji collé dans le texte | Le texte reste propre et c'est la métadonnée native d'Ink. Les tags sur les choix demandent une version récente d'inkjs |
| Choix « persistants » `+` en Ink | Choix `*` (à usage unique) | Évite que des choix disparaissent quand on revient sur une scène |

**Périmètre retenu** : 4 à 6 scènes narratives, plus 2 scènes de fin, et 2 à 3 choix par scène.

---

## 4. Expérience utilisateur

### Écran 1 — Création
- Champ « Ton idée ».
- Niveau de lecture en 3 pastilles, pour un public de **8 à 15 ans** : *8-10 ans* (CM1-CM2) / *11-12 ans* (6e-5e) / *13-15 ans* (4e-3e). Il est injecté dans le prompt (longueur des phrases, vocabulaire, ton, intensité).
- **Arbitrage** : on découpe par tranches d'âge plutôt que par libellés vagues (« enfant », « ado »), parce que c'est plus parlant pour un auteur et plus précis pour le LLM. Le contenu reste adapté à des mineurs pour tous les niveaux : pas de violence explicite, et une fin « sombre » plutôt douce-amère.
- Bouton « Générer l'aventure », avec un état de chargement soigné.

### Écran 2 — Histoire générée, deux modes avec une bascule dans l'en-tête

**Édition**
- **Carte** au centre : chaque scène est une carte (emoji, titre, couleur d'ambiance), chaque choix une flèche, et les 2 fins ont une couleur distincte.
- On peut cliquer sur les choix pour avancer dans la carte : le chemin parcouru s'allume, ce qui sert de test rapide de la structure.
- **Panneau latéral** pour la scène sélectionnée : texte, emoji, choix (libellé, emoji, destination), ajout ou suppression de choix.
- **Avertissements** visibles sur la carte : ⚠️ scène inaccessible, impasse, fin non atteignable.
- « ▶ Jouer depuis ici » ouvre Lecture à cette scène.

**Lecture**
- Plein écran épuré : grand emoji, texte, choix en gros boutons.
- En fin de partie : « Rejouer » et « Fins découvertes : 1/2 ».
- Un discret « ✏️ Modifier cette scène » renvoie dans Édition.

**En-tête commun** : titre, bascule Édition/Lecture, « Vérifier ».

**Barre du bas commune, visible en Édition comme en Lecture** : bouton « ⬇ Exporter le .ink » toujours accessible, avec dans un petit menu le .json compilé et l'aperçu du code Ink. L'indicateur « Enregistré » s'y affiche aussi.

**Une seule source de données** : une modification dans Édition se voit immédiatement dans Lecture.

**Sauvegarde automatique** dans le navigateur (`localStorage`) : un rafraîchissement de page ne fait rien perdre, et « Reprendre ton aventure » s'affiche au retour. C'est 5 lignes de code qui évitent un moment gênant en démo. Il n'y a pas de sauvegarde côté serveur.

**Langue** : interface et histoires toujours en français, même si l'idée est saisie dans une autre langue.

---

## 5. L'IA dans l'application

| Fonction | Principe | Statut |
|---|---|---|
| **Génération** | Structured outputs avec un champ `plan` écrit en premier (résumé, ce qui distingue les deux fins, ce que change chaque choix), ce qui améliore la cohérence | Cœur |
| **✨ Retravailler une scène** | Actions rapides (*Améliorer*, *Plus court*, *Plus de suspense*, *Adapter au niveau*) et consigne libre. L'histoire entière est envoyée pour le contexte, seule la scène revient. Aperçu, puis Garder ou Annuler | Cœur |
| **Annuler (Ctrl+Z)** | Pile de copies du JSON | Cœur |
| **Vérifier la cohérence** | Second appel « relecteur » qui renvoie une liste de problèmes en JSON, affichés en ⚠️ sur la carte, avec « Corriger avec l'IA » | Bonus |
| **3 variantes** | Un seul appel, l'auteur choisit parmi trois cartes | Bonus |
| **Changer d'idée** | L'IA régénère toute la suite à partir d'une scène (modifie le graphe, donc nouvelle vérification) | Bonus |
| **Verrouiller une scène** 🔒 | L'IA n'y touche plus | Bonus |
| **Illustrer** | Une image à la demande, via l'API images | Bonus |

Garde-fous : le serveur vérifie que « Retravailler » ne modifie pas les destinations des choix, et les emojis sont validés (un seul pictogramme, avec un emoji par défaut sinon).

---

## 6. Vérification de l'accessibilité

1. **Atteignabilité** (sens principal) : l'explorateur parcourt tous les chemins avec inkjs, en sauvegardant et restaurant l'état à chaque choix. Il signale les scènes jamais atteintes, les impasses (pas de choix et pas de fin), les fins non atteintes et les erreurs de compilation.
2. **Accessibilité de l'interface** (second sens possible du brief) : de vrais `<button>`, navigation au clavier, `aria-live` sur le texte de la scène, emojis en `aria-hidden`, contrastes suffisants.

---

## 7. Hors périmètre (assumé)

Comptes utilisateurs et sauvegarde côté serveur (seule la sauvegarde locale du navigateur est prévue), plusieurs langues, collaboration, carte complète pour les `.ink` importés, déplacement manuel des cartes, animations de caméra, images systématiques.

---

## 8. Points à défendre à l'oral

- Pourquoi du JSON plutôt que de l'Ink généré directement.
- Le code vérifie la structure, le LLM juge le récit.
- L'IA propose, l'auteur décide : aperçu, annulation, verrouillage.
- Briques réutilisées (inkjs, React Flow, structured outputs) plutôt que réinventées.
- Le double sens de « accessible » : atteignabilité et accessibilité de l'interface.
- Une réduction de périmètre réfléchie, avec des pistes suivantes documentées.

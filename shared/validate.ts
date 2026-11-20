// Structural checks on a Story (the JSON), shared by the server and the client:
//   - the server runs them on LLM output and retries once with the issues as feedback (step 4);
//   - the editor shows them as warnings, without blocking (step 6).
// These checks are about structure only. Whether every scene can actually be reached
// is answered by the explorer, which plays the compiled Ink.
// Messages are in French: they are shown to the author and sent back to the LLM.
import { isValidEmoji } from "./emoji";
import type { Story } from "./schema";

export interface ValidationIssue {
  sceneId?: string;
  choiceId?: string;
  message: string;
}

/** Story size limits (narrative scenes = scenes that are not endings). */
export const LIMITS = {
  minNarrativeScenes: 4,
  maxNarrativeScenes: 6,
  minChoices: 2,
  maxChoices: 3,
} as const;

/** A scene id becomes an Ink knot name: lowercase ASCII, digits and underscores. */
export const SCENE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Words that cannot (or should not) be used as knot names.
 * inkjs 2.4 refuses not/true/false/else/function/return/temp; the others compile
 * but are Ink keywords, so we refuse them too to stay on the safe side.
 */
export const INK_RESERVED_WORDS: ReadonlySet<string> = new Set([
  "end",
  "done",
  "not",
  "and",
  "or",
  "true",
  "false",
  "else",
  "function",
  "return",
  "var",
  "const",
  "temp",
  "list",
  "include",
  "external",
]);

export function isValidSceneId(id: string): boolean {
  return SCENE_ID_PATTERN.test(id) && !INK_RESERVED_WORDS.has(id);
}

export function validateStory(story: Story): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (message: string, sceneId?: string, choiceId?: string) =>
    issues.push({ sceneId, choiceId, message });

  if (story.scenes.length === 0) {
    add("L'histoire ne contient aucune scène.");
    return issues;
  }

  // Scene ids: format, reserved words, uniqueness.
  const sceneIds = new Set<string>();
  for (const scene of story.scenes) {
    if (!SCENE_ID_PATTERN.test(scene.id)) {
      add(
        `Identifiant de scène invalide « ${scene.id} » : lettres minuscules sans accent, chiffres et _ uniquement, en commençant par une lettre.`,
        scene.id,
      );
    } else if (INK_RESERVED_WORDS.has(scene.id)) {
      add(`L'identifiant « ${scene.id} » est un mot réservé d'Ink.`, scene.id);
    }
    if (sceneIds.has(scene.id))
      add(`L'identifiant de scène « ${scene.id} » est utilisé deux fois.`, scene.id);
    sceneIds.add(scene.id);
  }

  if (!sceneIds.has(story.startSceneId)) {
    add(`La scène de départ « ${story.startSceneId} » n'existe pas.`);
  }

  for (const scene of story.scenes) {
    if (!scene.title.trim()) add("La scène n'a pas de titre.", scene.id);
    if (!scene.text.trim()) add("La scène n'a pas de texte.", scene.id);
    if (!isValidEmoji(scene.emoji))
      add(`L'emoji de la scène « ${scene.emoji} » n'est pas un emoji unique.`, scene.id);

    // Endings and choices are mutually exclusive.
    if (scene.ending && scene.choices.length > 0) {
      add("Une fin ne doit pas proposer de choix.", scene.id);
    }
    if (!scene.ending && scene.choices.length === 0) {
      add("Impasse : la scène n'a ni choix ni fin.", scene.id);
    }
    if (scene.ending && !scene.ending.label.trim()) add("La fin n'a pas de libellé.", scene.id);
    if (scene.ending && scene.id === story.startSceneId) {
      add("La scène de départ ne peut pas être une fin.", scene.id);
    }

    // Choices: count, unique ids, label, emoji, existing target.
    if (!scene.ending && scene.choices.length > 0) {
      const n = scene.choices.length;
      if (n < LIMITS.minChoices || n > LIMITS.maxChoices) {
        add(
          `La scène propose ${n} choix au lieu de ${LIMITS.minChoices} à ${LIMITS.maxChoices}.`,
          scene.id,
        );
      }
    }
    const choiceIds = new Set<string>();
    const targets = new Set<string>();
    for (const choice of scene.choices) {
      // Two choices to the same place are not a real choice for the reader.
      if (choice.targetSceneId && targets.has(choice.targetSceneId)) {
        add(
          `Deux choix de la scène mènent tous les deux à « ${choice.targetSceneId} » : chaque choix doit mener ailleurs.`,
          scene.id,
          choice.id,
        );
      }
      targets.add(choice.targetSceneId);
      if (choiceIds.has(choice.id))
        add(`L'identifiant de choix « ${choice.id} » est utilisé deux fois.`, scene.id, choice.id);
      choiceIds.add(choice.id);
      if (!choice.label.trim()) add("Le choix n'a pas de libellé.", scene.id, choice.id);
      if (!isValidEmoji(choice.emoji)) {
        add(`L'emoji du choix « ${choice.emoji} » n'est pas un emoji unique.`, scene.id, choice.id);
      }
      if (!choice.targetSceneId) {
        add("Destination manquante : le choix ne mène nulle part.", scene.id, choice.id);
      } else if (!sceneIds.has(choice.targetSceneId)) {
        add(
          `Destination manquante : la scène « ${choice.targetSceneId} » n'existe pas.`,
          scene.id,
          choice.id,
        );
      } else if (choice.targetSceneId === scene.id) {
        add("Le choix ramène à la même scène.", scene.id, choice.id);
      }
    }
  }

  // Exactly two endings: one A and one B.
  const endings = story.scenes.filter((scene) => scene.ending);
  const kinds = endings.map((scene) => scene.ending!.kind);
  if (endings.length !== 2 || !kinds.includes("A") || !kinds.includes("B")) {
    add(
      `L'histoire doit avoir exactement 2 fins, une A et une B (actuellement : ${
        kinds.length > 0 ? kinds.join(", ") : "aucune"
      }).`,
    );
  }

  const narrative = story.scenes.length - endings.length;
  if (narrative < LIMITS.minNarrativeScenes || narrative > LIMITS.maxNarrativeScenes) {
    add(
      `L'histoire a ${narrative} scènes narratives au lieu de ${LIMITS.minNarrativeScenes} à ${LIMITS.maxNarrativeScenes}.`,
    );
  }

  issues.push(...checkGraph(story));
  return issues;
}

/**
 * Reachability on the JSON graph (scenes = nodes, choices = edges).
 * Needed on the server: a real LLM answer passed every local check above but had an
 * ending that no choice led to. Our stories have no conditions, so this graph check gives
 * the same answer as the Ink explorer, without compiling (the server has no Ink compiler).
 *   - forward search from the start: every scene must be reachable;
 *   - backward search from the endings: from every reachable scene, an ending must be reachable
 *     (otherwise the reader is stuck in a loop with no way out).
 */
function checkGraph(story: Story): ValidationIssue[] {
  const ids = new Set(story.scenes.map((scene) => scene.id));
  if (!ids.has(story.startSceneId)) return []; // already reported above

  const next = new Map<string, string[]>();
  const previous = new Map<string, string[]>();
  for (const scene of story.scenes) {
    const targets = scene.choices.map((c) => c.targetSceneId).filter((id) => ids.has(id));
    next.set(scene.id, targets);
    for (const target of targets) previous.set(target, [...(previous.get(target) ?? []), scene.id]);
  }

  const search = (starts: string[], edges: Map<string, string[]>): Set<string> => {
    const seen = new Set(starts);
    const queue = [...starts];
    while (queue.length > 0) {
      for (const id of edges.get(queue.shift()!) ?? []) {
        if (!seen.has(id)) {
          seen.add(id);
          queue.push(id);
        }
      }
    }
    return seen;
  };

  const reachable = search([story.startSceneId], next);
  const endingIds = story.scenes.filter((scene) => scene.ending).map((scene) => scene.id);
  const canFinish = search(endingIds, previous);

  const issues: ValidationIssue[] = [];
  for (const scene of story.scenes) {
    if (!reachable.has(scene.id)) {
      const what = scene.ending ? `La fin ${scene.ending.kind}` : "Cette scène";
      issues.push({
        sceneId: scene.id,
        message: `${what} n'est jamais atteinte : aucun chemin n'y mène depuis la scène de départ.`,
      });
    } else if (!scene.ending && scene.choices.length > 0 && !canFinish.has(scene.id)) {
      // Scenes without choices are already reported as dead ends.
      issues.push({
        sceneId: scene.id,
        message: "Aucune fin n'est atteignable depuis cette scène : le lecteur tourne en rond.",
      });
    }
  }
  return issues;
}

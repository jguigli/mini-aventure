// Structural checks on a Story (the JSON), shared by the server and the client:
//   - the server runs them on LLM output and retries once with the issues as feedback (step 4);
//   - the editor shows them as warnings, without blocking (step 6).
// These checks are about structure only. Whether every scene can actually be reached
// is answered by the explorer, which plays the compiled Ink.
// Messages are in French: they are shown to the author and sent back to the LLM.
import { isValidEmoji } from "./emoji";
import type { Story } from "./schema";

/** Machine-readable kind of issue (the message is for humans, the code is for the program). */
export type IssueCode =
  | "no_scenes"
  | "invalid_scene_id"
  | "reserved_scene_id"
  | "duplicate_scene_id"
  | "missing_start"
  | "start_is_ending"
  | "missing_title"
  | "missing_text"
  | "invalid_emoji"
  | "ending_with_choices"
  | "dead_end"
  | "missing_ending_label"
  | "choice_count"
  | "duplicate_target"
  | "duplicate_choice_id"
  | "missing_label"
  | "missing_target"
  | "self_target"
  | "ending_count"
  | "narrative_count"
  | "unreachable"
  | "no_way_to_ending";

export interface ValidationIssue {
  code: IssueCode;
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
  const add = (code: IssueCode, message: string, sceneId?: string, choiceId?: string) =>
    issues.push({ code, sceneId, choiceId, message });

  if (story.scenes.length === 0) {
    add("no_scenes", "L'histoire ne contient aucune scène.");
    return issues;
  }

  // Scene ids: format, reserved words, uniqueness.
  const sceneIds = new Set<string>();
  for (const scene of story.scenes) {
    if (!SCENE_ID_PATTERN.test(scene.id)) {
      add(
        "invalid_scene_id",
        `Identifiant de scène invalide « ${scene.id} » : lettres minuscules sans accent, chiffres et _ uniquement, en commençant par une lettre.`,
        scene.id,
      );
    } else if (INK_RESERVED_WORDS.has(scene.id)) {
      add("reserved_scene_id", `L'identifiant « ${scene.id} » est un mot réservé d'Ink.`, scene.id);
    }
    if (sceneIds.has(scene.id))
      add(
        "duplicate_scene_id",
        `L'identifiant de scène « ${scene.id} » est utilisé deux fois.`,
        scene.id,
      );
    sceneIds.add(scene.id);
  }

  if (!sceneIds.has(story.startSceneId)) {
    add("missing_start", `La scène de départ « ${story.startSceneId} » n'existe pas.`);
  }

  for (const scene of story.scenes) {
    if (!scene.title.trim()) add("missing_title", "La scène n'a pas de titre.", scene.id);
    if (!scene.text.trim()) add("missing_text", "La scène n'a pas de texte.", scene.id);
    if (!isValidEmoji(scene.emoji))
      add(
        "invalid_emoji",
        `L'emoji de la scène « ${scene.emoji} » n'est pas un emoji unique.`,
        scene.id,
      );

    // Endings and choices are mutually exclusive.
    if (scene.ending && scene.choices.length > 0) {
      add("ending_with_choices", "Une fin ne doit pas proposer de choix.", scene.id);
    }
    if (!scene.ending && scene.choices.length === 0) {
      add("dead_end", "Impasse : la scène n'a ni choix ni fin.", scene.id);
    }
    if (scene.ending && !scene.ending.label.trim())
      add("missing_ending_label", "La fin n'a pas de libellé.", scene.id);
    if (scene.ending && scene.id === story.startSceneId) {
      add("start_is_ending", "La scène de départ ne peut pas être une fin.", scene.id);
    }

    // Choices: count, unique ids, label, emoji, existing target.
    if (!scene.ending && scene.choices.length > 0) {
      const n = scene.choices.length;
      if (n < LIMITS.minChoices || n > LIMITS.maxChoices) {
        add(
          "choice_count",
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
          "duplicate_target",
          `Deux choix de la scène mènent tous les deux à « ${choice.targetSceneId} » : chaque choix doit mener ailleurs.`,
          scene.id,
          choice.id,
        );
      }
      targets.add(choice.targetSceneId);
      if (choiceIds.has(choice.id))
        add(
          "duplicate_choice_id",
          `L'identifiant de choix « ${choice.id} » est utilisé deux fois.`,
          scene.id,
          choice.id,
        );
      choiceIds.add(choice.id);
      if (!choice.label.trim())
        add("missing_label", "Le choix n'a pas de libellé.", scene.id, choice.id);
      if (!isValidEmoji(choice.emoji)) {
        add(
          "invalid_emoji",
          `L'emoji du choix « ${choice.emoji} » n'est pas un emoji unique.`,
          scene.id,
          choice.id,
        );
      }
      if (!choice.targetSceneId) {
        add(
          "missing_target",
          "Destination manquante : le choix ne mène nulle part.",
          scene.id,
          choice.id,
        );
      } else if (!sceneIds.has(choice.targetSceneId)) {
        add(
          "missing_target",
          `Destination manquante : la scène « ${choice.targetSceneId} » n'existe pas.`,
          scene.id,
          choice.id,
        );
      } else if (choice.targetSceneId === scene.id) {
        add("self_target", "Le choix ramène à la même scène.", scene.id, choice.id);
      }
    }
  }

  // Exactly two endings: one A and one B.
  const endings = story.scenes.filter((scene) => scene.ending);
  const kinds = endings.map((scene) => scene.ending!.kind);
  if (endings.length !== 2 || !kinds.includes("A") || !kinds.includes("B")) {
    add(
      "ending_count",
      `L'histoire doit avoir exactement 2 fins, une A et une B (actuellement : ${
        kinds.length > 0 ? kinds.join(", ") : "aucune"
      }).`,
    );
  }

  const narrative = story.scenes.length - endings.length;
  if (narrative < LIMITS.minNarrativeScenes || narrative > LIMITS.maxNarrativeScenes) {
    add(
      "narrative_count",
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
      // Actionable message: it is shown to the author AND sent to the LLM on retry.
      const what = scene.ending
        ? `La fin ${scene.ending.kind} « ${scene.id} »`
        : `La scène « ${scene.id} »`;
      issues.push({
        code: "unreachable",
        sceneId: scene.id,
        message: `${what} n'est jamais atteinte depuis la scène de départ : fais pointer au moins un choix d'une scène atteignable vers « ${scene.id} ».`,
      });
    } else if (!scene.ending && scene.choices.length > 0 && !canFinish.has(scene.id)) {
      // Scenes without choices are already reported as dead ends.
      issues.push({
        code: "no_way_to_ending",
        sceneId: scene.id,
        message:
          "Aucune fin n'est atteignable depuis cette scène : le lecteur tourne en rond. Fais mener un de ses choix vers une fin, ou vers une scène qui y mène.",
      });
    }
  }
  return issues;
}

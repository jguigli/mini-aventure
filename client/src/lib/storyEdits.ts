// Pure editing operations on a Story. Each one returns a NEW story (never mutates its input),
// which is what the undo history stores. The editor calls them through storyStore.edit().
import type { Choice, Scene, SceneRewrite, Story } from "@shared/schema";
import { INK_RESERVED_WORDS } from "@shared/validate";

/** "Le Phare d'été !" → "le_phare_d_ete": lowercase ASCII, digits and underscores. */
export function slugify(text: string, separator = "_"): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "");
}

/**
 * A valid, unused scene id derived from a title: starts with a letter, avoids Ink reserved
 * words, and gets a _2, _3… suffix if already taken. Scene ids are never edited afterwards,
 * so renaming a scene can never break the choices that lead to it.
 */
export function uniqueSceneId(title: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  let base = slugify(title) || "scene";
  if (!/^[a-z]/.test(base)) base = `scene_${base}`;
  if (INK_RESERVED_WORDS.has(base)) base = `${base}_scene`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
  return id;
}

/** Next free choice id in a scene: c1, c2, c3… */
export function nextChoiceId(scene: Scene): string {
  const used = new Set(scene.choices.map((c) => c.id));
  let n = 1;
  while (used.has(`c${n}`)) n++;
  return `c${n}`;
}

const mapScene = (story: Story, sceneId: string, update: (scene: Scene) => Scene): Story => ({
  ...story,
  scenes: story.scenes.map((scene) => (scene.id === sceneId ? update(scene) : scene)),
});

export function updateScene(
  story: Story,
  sceneId: string,
  patch: Partial<Pick<Scene, "title" | "emoji" | "mood" | "text">>,
): Story {
  return mapScene(story, sceneId, (scene) => ({ ...scene, ...patch }));
}

export function updateEndingLabel(story: Story, sceneId: string, label: string): Story {
  return mapScene(story, sceneId, (scene) =>
    scene.ending ? { ...scene, ending: { ...scene.ending, label } } : scene,
  );
}

export function updateChoice(
  story: Story,
  sceneId: string,
  choiceId: string,
  patch: Partial<Omit<Choice, "id">>,
): Story {
  return mapScene(story, sceneId, (scene) => ({
    ...scene,
    choices: scene.choices.map((c) => (c.id === choiceId ? { ...c, ...patch } : c)),
  }));
}

/** Adds a choice with no target yet: it is flagged « destination manquante » until set. */
export function addChoice(story: Story, sceneId: string): { story: Story; choiceId: string } {
  const scene = story.scenes.find((s) => s.id === sceneId);
  if (!scene || scene.ending) return { story, choiceId: "" };
  const choiceId = nextChoiceId(scene);
  const choice: Choice = { id: choiceId, label: "Nouveau choix", emoji: "👣", targetSceneId: "" };
  return {
    story: mapScene(story, sceneId, (s) => ({ ...s, choices: [...s.choices, choice] })),
    choiceId,
  };
}

export function removeChoice(story: Story, sceneId: string, choiceId: string): Story {
  return mapScene(story, sceneId, (scene) => ({
    ...scene,
    choices: scene.choices.filter((c) => c.id !== choiceId),
  }));
}

/** Adds an empty narrative scene. Not connected yet: the checks flag it until a choice leads to it. */
export function addScene(
  story: Story,
  title = "Nouvelle scène",
): { story: Story; sceneId: string } {
  const sceneId = uniqueSceneId(
    title,
    story.scenes.map((s) => s.id),
  );
  const scene: Scene = {
    id: sceneId,
    title,
    emoji: "📖",
    mood: "calme",
    text: "",
    choices: [],
    ending: null,
  };
  return { story: { ...story, scenes: [...story.scenes, scene] }, sceneId };
}

/**
 * Removes a scene. The start scene cannot be removed. Choices that led to the removed scene
 * are KEPT, now flagged « destination manquante »: the author decides where they go
 * (and Ctrl+Z brings the scene back).
 */
export function removeScene(story: Story, sceneId: string): Story {
  if (sceneId === story.startSceneId) return story;
  return { ...story, scenes: story.scenes.filter((s) => s.id !== sceneId) };
}

/** 🔒 Locked scenes are never sent to the AI for a rewrite. */
export function setLocked(story: Story, sceneId: string, locked: boolean): Story {
  return mapScene(story, sceneId, (scene) => ({ ...scene, locked }));
}

/**
 * Applies an AI rewrite the author chose to keep. Only the words come from the proposal:
 * the scene id, the ending kind, the lock and every choice's id and TARGET stay the original
 * ones. Choices are matched by id, so a rewrite can never change where a choice leads.
 */
export function applySceneRewrite(story: Story, sceneId: string, rewrite: SceneRewrite): Story {
  return mapScene(story, sceneId, (scene) => ({
    ...scene,
    title: rewrite.title,
    emoji: rewrite.emoji,
    mood: rewrite.mood,
    text: rewrite.text,
    choices: scene.choices.map((choice) => {
      const proposed = rewrite.choices.find((c) => c.id === choice.id);
      return proposed
        ? { ...choice, label: proposed.label, emoji: proposed.emoji, outcome: proposed.outcome }
        : choice;
    }),
    ending: scene.ending
      ? { ...scene.ending, label: rewrite.endingLabel ?? scene.ending.label }
      : null,
  }));
}

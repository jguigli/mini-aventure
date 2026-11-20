// Data model shared by the client and the server, written once in zod.
// The same schemas give us: TypeScript types (z.infer), runtime validation
// (API inputs, localStorage, example files) and the strict JSON schema sent to OpenAI.
import { z } from "zod";

export const ReadingLevel = z.enum(["8-10", "11-12", "13-15"]);
export const Mood = z.enum(["calme", "mystere", "tension", "joie", "sombre"]);
export const EndingKind = z.enum(["A", "B"]);

export const Choice = z.object({
  id: z.string(), // e.g. "c1"
  label: z.string(), // button text
  emoji: z.string(), // a single emoji
  targetSceneId: z.string(), // must exist: checked by validateStory, not by the schema
  /**
   * What happens right after this choice, leading into the target scene (one sentence).
   * Shown just before the next scene, so a scene reached by several choices still follows
   * logically from each of them. Optional in the app (choices added in the editor).
   */
  outcome: z.string().optional(),
});

// Choice as the LLM must write it: the target is decided FIRST (field order guides the
// generation), then the label and the outcome, which must lead to that target.
export const LlmChoice = z.object({
  id: z.string(),
  targetSceneId: z.string(),
  label: z.string(),
  emoji: z.string(),
  outcome: z.string(),
});

export const Ending = z.object({
  kind: EndingKind,
  label: z.string(),
});

// Schema sent to the LLM. OpenAI strict mode requires every field to be present,
// so an optional value is written `.nullable()` (it becomes `anyOf [..., null]`),
// never `.optional()`.
export const LlmScene = z.object({
  id: z.string(), // valid Ink identifier: [a-z][a-z0-9_]*, not an Ink reserved word
  title: z.string(),
  emoji: z.string(),
  mood: Mood,
  text: z.string(), // 2 to 5 sentences depending on the reading level
  choices: z.array(LlmChoice), // empty if and only if the scene is an ending
  ending: Ending.nullable(),
});

export const Plan = z.object({
  summary: z.string(),
  endingA: z.string(),
  endingB: z.string(),
});

export const LlmStory = z.object({
  // First field on purpose: the model writes its plan before the scenes.
  plan: Plan,
  title: z.string(),
  readingLevel: ReadingLevel,
  startSceneId: z.string(),
  scenes: z.array(LlmScene),
});

// App model: what the LLM returns, plus editor-only fields.
// `locked` is never part of the LLM schema (strict mode rejects optional fields).
export const Scene = LlmScene.extend({
  choices: z.array(Choice), // the outcome is optional in the app
  locked: z.boolean().optional(), // bonus: the AI no longer touches this scene
});

export const Story = LlmStory.extend({
  scenes: z.array(Scene),
});

export type ReadingLevel = z.infer<typeof ReadingLevel>;
export type Mood = z.infer<typeof Mood>;
export type EndingKind = z.infer<typeof EndingKind>;
export type Choice = z.infer<typeof Choice>;
export type Ending = z.infer<typeof Ending>;
export type LlmScene = z.infer<typeof LlmScene>;
export type LlmStory = z.infer<typeof LlmStory>;
export type Scene = z.infer<typeof Scene>;
export type Story = z.infer<typeof Story>;

// ---------- Scene rewrite (step 9) ----------

/**
 * What the LLM may change when it rewrites ONE scene: the words, never the structure.
 * Choices come back by id, without targets: the code merges them into the original scene,
 * so a rewrite can never change where a choice leads (nor the scene id or ending kind).
 */
export const SceneRewrite = z.object({
  title: z.string(),
  emoji: z.string(),
  mood: Mood,
  text: z.string(),
  choices: z.array(
    z.object({ id: z.string(), label: z.string(), emoji: z.string(), outcome: z.string() }),
  ),
  endingLabel: z.string().nullable(), // filled if and only if the scene is an ending
});

export const LlmSceneRewrites = z.object({
  variants: z.array(SceneRewrite),
});

export type SceneRewrite = z.infer<typeof SceneRewrite>;
export type LlmSceneRewrites = z.infer<typeof LlmSceneRewrites>;

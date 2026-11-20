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
  choices: z.array(Choice), // empty if and only if the scene is an ending
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

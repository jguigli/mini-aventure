// API contract shared by the client and the server.
// Imported on both sides through the `@shared/*` alias.
import { z } from "zod";
import { ReadingLevel, Story, type SceneRewrite } from "./schema";
import type { ValidationIssue } from "./validate";

export const API_HEALTH_PATH = "/api/health";
export const API_GENERATE_PATH = "/api/generate";
export const API_REWRITE_PATH = "/api/rewrite";

/** Maximum length of the author's idea (characters). */
export const MAX_IDEA_LENGTH = 500;

/** GET /api/health response. Never contains the key, only whether it is set. */
export interface HealthResponse {
  ok: true;
  openaiKey: boolean;
}

/** Common shape of API errors (the message itself is in French, shown in the UI). */
export interface ApiError {
  error: string;
}

/** POST /api/generate body. Messages are in French: they are shown to the author. */
export const GenerateRequest = z.object({
  idea: z
    .string({ error: "L'idée est obligatoire." })
    .trim()
    .min(1, "Écris une idée d'histoire.")
    .max(MAX_IDEA_LENGTH, `L'idée ne doit pas dépasser ${MAX_IDEA_LENGTH} caractères.`),
  readingLevel: z.enum(ReadingLevel.options, {
    error: "Choisis un niveau de lecture : 8-10, 11-12 ou 13-15.",
  }),
});
export type GenerateRequest = z.infer<typeof GenerateRequest>;

/** POST /api/generate response. */
export interface GenerateResponse {
  story: Story;
  /**
   * Issues the model left after its retry, all fixable in the editor (see FIXABLE_IN_EDITOR
   * on the server). Empty for a valid story. The editor shows them live anyway; this list
   * lets the UI tell the author right away.
   */
  warnings: ValidationIssue[];
}

/** Maximum length of a free rewrite instruction (characters). */
export const MAX_INSTRUCTION_LENGTH = 300;

/** POST /api/rewrite body: the whole story (for context) and the scene to rewrite. */
export const RewriteRequest = z.object({
  story: Story,
  sceneId: z.string(),
  instruction: z
    .string({ error: "La consigne est obligatoire." })
    .trim()
    .min(1, "Écris une consigne pour l'IA.")
    .max(
      MAX_INSTRUCTION_LENGTH,
      `La consigne ne doit pas dépasser ${MAX_INSTRUCTION_LENGTH} caractères.`,
    ),
  /** 1 proposal, or 3 to choose from. */
  variants: z.union([z.literal(1), z.literal(3)]).default(1),
});
export type RewriteRequest = z.input<typeof RewriteRequest>;

/** POST /api/rewrite response: proposals, already checked by the server. */
export interface RewriteResponse {
  variants: SceneRewrite[];
}

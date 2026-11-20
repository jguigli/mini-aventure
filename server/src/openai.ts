// The only file that talks to OpenAI.
// Structured outputs: each zod schema (LlmStory, LlmSceneRewrites) is converted by the SDK
// helper into a strict JSON schema (strict: true, additionalProperties: false, nullable fields
// as anyOf [..., null]). The API guarantees the SHAPE of the answer; the CONTENT is checked
// by our code (validateStory, checkRewrites).
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { LlmSceneRewrites, LlmStory } from "@shared/schema";
import { env, modelName } from "./env";
import { HttpError } from "./errors";
import type { CallModel, ModelMessage, ModelUsage } from "./generate";
import { REWRITE_SYSTEM_PROMPT, SYSTEM_PROMPT } from "./prompts";
import type { CallRewriteModel } from "./rewrite";

export const OPENAI_TIMEOUT_MS = 90_000;

/**
 * A little reasoning before answering. Without it, real generations made graph mistakes
 * (an ending no choice led to, a choice to a scene that does not exist) that even the
 * retry did not fix. "low" keeps generation fast and cheap.
 */
export const REASONING_EFFORT = "low" as const;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!env.openaiApiKey) {
    throw new HttpError(503, "Clé manquante : renseigne OPENAI_API_KEY dans server/.env.");
  }
  // maxRetries: 0 — no silent SDK retries: every paid call is one we decided to make.
  client ??= new OpenAI({ apiKey: env.openaiApiKey, timeout: OPENAI_TIMEOUT_MS, maxRetries: 0 });
  return client;
}

/**
 * One structured-output call: the zod schema becomes a strict JSON schema, so the API
 * guarantees the shape of the answer. Handles refusals and cut answers.
 */
async function callStructured<T>(
  schema: z.ZodType<T>,
  name: string,
  instructions: string,
  messages: ModelMessage[],
): Promise<{ data: T; usage: ModelUsage }> {
  const response = await getClient().responses.parse({
    model: modelName(),
    instructions,
    input: messages,
    reasoning: { effort: REASONING_EFFORT },
    text: { format: zodTextFormat(schema, name) },
  });
  console.log(
    `[openai] ${name} : effort ${response.reasoning?.effort ?? "?"}, tokens de raisonnement ${
      response.usage?.output_tokens_details?.reasoning_tokens ?? 0
    }`,
  );

  // The model can refuse (safety): the answer then holds a refusal instead of JSON.
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type === "refusal") {
        console.warn(`[openai] refus du modèle : ${part.refusal}`);
        throw new HttpError(422, "L'IA a refusé cette demande. Essaie une autre formulation.");
      }
    }
  }
  if (response.status === "incomplete") {
    console.warn("[openai] réponse incomplète :", response.incomplete_details);
    throw new HttpError(502, "La réponse de l'IA a été coupée. Réessaie.");
  }
  if (!response.output_parsed) {
    throw new HttpError(502, "L'IA n'a pas renvoyé de réponse exploitable. Réessaie.");
  }

  return {
    data: response.output_parsed as T,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
  };
}

/** Real model call used by generateStory. */
export const callOpenAiForStory: CallModel = async (messages) => {
  const { data, usage } = await callStructured(LlmStory, "story", SYSTEM_PROMPT, messages);
  return { story: data, usage };
};

/** Real model call used by rewriteScene. */
export const callOpenAiForRewrite: CallRewriteModel = async (messages) => {
  const { data, usage } = await callStructured(
    LlmSceneRewrites,
    "scene_rewrites",
    REWRITE_SYSTEM_PROMPT,
    messages,
  );
  return { variants: data.variants, usage };
};

// The only file that talks to OpenAI.
// Structured outputs: the zod schema LlmStory is converted by the SDK helper into a strict
// JSON schema (strict: true, additionalProperties: false, `ending` as anyOf [object, null]).
// The API then guarantees the SHAPE of the answer; the CONTENT is checked by validateStory.
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { LlmStory } from "@shared/schema";
import { env, modelName } from "./env";
import { HttpError } from "./errors";
import type { CallModel } from "./generate";
import { SYSTEM_PROMPT } from "./prompts";

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

/** Real model call used by generateStory. */
export const callOpenAiForStory: CallModel = async (messages) => {
  const response = await getClient().responses.parse({
    model: modelName(),
    instructions: SYSTEM_PROMPT,
    input: messages,
    reasoning: { effort: REASONING_EFFORT },
    text: { format: zodTextFormat(LlmStory, "story") },
  });
  console.log(
    `[openai] effort ${response.reasoning?.effort ?? "?"}, tokens de raisonnement ${
      response.usage?.output_tokens_details?.reasoning_tokens ?? 0
    }`,
  );

  // The model can refuse (safety): the answer then holds a refusal instead of JSON.
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type === "refusal") {
        console.warn(`[openai] refus du modèle : ${part.refusal}`);
        throw new HttpError(422, "L'IA a refusé d'écrire cette histoire. Essaie une autre idée.");
      }
    }
  }
  if (response.status === "incomplete") {
    console.warn("[openai] réponse incomplète :", response.incomplete_details);
    throw new HttpError(502, "La réponse de l'IA a été coupée. Réessaie.");
  }
  if (!response.output_parsed) {
    throw new HttpError(502, "L'IA n'a pas renvoyé d'histoire. Réessaie.");
  }

  return {
    story: response.output_parsed,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
  };
};

// Loads configuration from server/.env.
// The path is resolved relative to this file, so it works whichever directory
// the server is started from (monorepo root or server/).
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

export const env = {
  port: Number(process.env.PORT) || 3001,
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
  openaiModel: process.env.OPENAI_MODEL?.trim() || null,
};

/** True when an OpenAI key is set. Its validity is not checked here. */
export const hasOpenAiKey = (): boolean => env.openaiApiKey !== null;

/** Lightweight model with structured outputs support; override with OPENAI_MODEL. */
export const DEFAULT_MODEL = "gpt-5.4-mini";

export const modelName = (): string => env.openaiModel ?? DEFAULT_MODEL;

// Story generation workflow: "the LLM proposes, the code verifies".
//   1. Ask the model for a story (structured output: the JSON shape is guaranteed by the API).
//   2. Fix emojis silently, then run validateStory (the structure is checked by code).
//   3. If there are issues, retry ONCE, sending the exact issues back to the model.
//   4. Still invalid: give up with a clear error rather than return a broken story.
// The model call is injected (`callModel`), so this workflow is unit-tested without
// spending anything; the real OpenAI call lives in openai.ts.
import { normalizeStoryEmojis } from "@shared/emoji";
import type { LlmStory, ReadingLevel, Story } from "@shared/schema";
import { validateStory, type ValidationIssue } from "@shared/validate";
import { buildGenerateInput, buildRetryInput } from "./prompts";

/** One turn of the conversation sent to the model. */
export interface ModelMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Calls the model with the conversation so far; returns the parsed story. */
export type CallModel = (
  messages: ModelMessage[],
) => Promise<{ story: LlmStory; usage: ModelUsage }>;

/** Raised when the story is still invalid after the retry. Message in French, for the author. */
export class InvalidStoryError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(
      "L'IA n'a pas réussi à produire une histoire valide après deux essais. Réessaie, ou reformule ton idée.",
    );
    this.name = "InvalidStoryError";
  }
}

export interface GenerateResult {
  story: Story;
  attempts: number;
  usage: ModelUsage;
}

/** Fixes what can be fixed without the model: emojis, and the requested reading level. */
function postProcess(raw: LlmStory, readingLevel: ReadingLevel): Story {
  return normalizeStoryEmojis({ ...raw, readingLevel });
}

export async function generateStory(
  idea: string,
  readingLevel: ReadingLevel,
  callModel: CallModel,
): Promise<GenerateResult> {
  const messages: ModelMessage[] = [
    { role: "user", content: buildGenerateInput(idea, readingLevel) },
  ];
  const usage: ModelUsage = { inputTokens: 0, outputTokens: 0 };

  const MAX_ATTEMPTS = 2; // first try + one retry
  let issues: ValidationIssue[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await callModel(messages);
    usage.inputTokens += result.usage.inputTokens;
    usage.outputTokens += result.usage.outputTokens;

    const story = postProcess(result.story, readingLevel);
    issues = validateStory(story);
    if (issues.length === 0) return { story, attempts: attempt, usage };

    // Retry: show the model its own answer and the exact problems found by the code.
    messages.push({ role: "assistant", content: JSON.stringify(result.story) });
    messages.push({ role: "user", content: buildRetryInput(issues, story) });
  }
  throw new InvalidStoryError(issues);
}

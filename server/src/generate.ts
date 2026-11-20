// Story generation workflow: "the LLM proposes, the code verifies".
//   1. Ask the model for a story (structured output: the JSON shape is guaranteed by the API).
//   2. Fix emojis silently, then run validateStory (the structure is checked by code).
//   3. If there are issues, retry ONCE, sending the exact issues back to the model.
//   4. Still invalid after the retry:
//      - if every remaining issue can be fixed in the editor (a missing target, an ending no
//        choice leads to…), return the story WITH its warnings: the editor flags them and the
//        author repairs them in a few clicks ("the author decides") instead of losing the story;
//      - otherwise (broken ids, wrong number of endings…), give up with a clear error.
// The model call is injected (`callModel`), so this workflow is unit-tested without
// spending anything; the real OpenAI call lives in openai.ts.
import { normalizeStoryEmojis } from "@shared/emoji";
import type { LlmStory, ReadingLevel, Story } from "@shared/schema";
import { validateStory, type IssueCode, type ValidationIssue } from "@shared/validate";
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
  /** Issues left after the retry, all fixable in the editor. Empty for a valid story. */
  warnings: ValidationIssue[];
}

/**
 * Issues the author can fix in the editor: re-target or delete a choice, add or delete a
 * scene, edit a text. Everything else (scene ids, which the editor does not let you rename;
 * the start scene; the number of endings; duplicate choice ids) blocks the story.
 * An allowlist: a new issue code is blocking until it is deliberately added here.
 */
export const FIXABLE_IN_EDITOR: ReadonlySet<IssueCode> = new Set<IssueCode>([
  "missing_target",
  "unreachable",
  "no_way_to_ending",
  "dead_end",
  "duplicate_target",
  "self_target",
  "choice_count",
  "narrative_count",
  "ending_with_choices",
  "invalid_emoji",
  "missing_title",
  "missing_text",
  "missing_label",
  "missing_ending_label",
]);

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
    if (issues.length === 0) return { story, attempts: attempt, usage, warnings: [] };

    const fixable = issues.every((issue) => FIXABLE_IN_EDITOR.has(issue.code));
    if (attempt === MAX_ATTEMPTS && fixable) {
      return { story, attempts: attempt, usage, warnings: issues };
    }

    // Retry: show the model its own answer and the exact problems found by the code.
    messages.push({ role: "assistant", content: JSON.stringify(result.story) });
    messages.push({ role: "user", content: buildRetryInput(issues, story) });
  }
  throw new InvalidStoryError(issues);
}

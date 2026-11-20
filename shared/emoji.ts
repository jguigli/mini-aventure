// Emoji validation and normalization, shared by the server (LLM output) and the client (editor).
// An emoji is valid when it is exactly one grapheme and that grapheme is pictographic.
// We work on graphemes, not code points, so composed emojis (🏖️, 👩‍🚀, ☀️) are never cut in half.
import type { Story } from "./schema";

export const DEFAULT_EMOJI = "📖";

const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const segmenter = new Intl.Segmenter("fr", { granularity: "grapheme" });

function graphemes(value: string): string[] {
  return Array.from(segmenter.segment(value.trim()), (part) => part.segment);
}

/** True for a single pictographic grapheme ("🗼", "🏖️"), false for "", "ab", "🗼🌊", "★ ok". */
export function isValidEmoji(value: string): boolean {
  const parts = graphemes(value);
  return parts.length === 1 && PICTOGRAPHIC.test(parts[0]);
}

/** Keeps the first grapheme if it is a valid emoji, otherwise falls back to 📖. */
export function normalizeEmoji(value: string): string {
  const first = graphemes(value)[0] ?? "";
  return isValidEmoji(first) ? first : DEFAULT_EMOJI;
}

/**
 * Normalizes every emoji of a story (scenes and choices). Silent fix, no LLM retry:
 * a wrong emoji is cosmetic, it does not justify a second paid call.
 */
export function normalizeStoryEmojis<T extends Pick<Story, "scenes">>(story: T): T {
  return {
    ...story,
    scenes: story.scenes.map((scene) => ({
      ...scene,
      emoji: normalizeEmoji(scene.emoji),
      choices: scene.choices.map((choice) => ({ ...choice, emoji: normalizeEmoji(choice.emoji) })),
    })),
  };
}

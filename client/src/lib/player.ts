// Playback engine for the Reader: drives the REAL compiled inkjs story, not the JSON.
// That is the point of the Reader: if a story plays here, the exported .ink works.
// Everything shown comes from the Ink itself: text from Continue(), and scene metadata
// from the tags written by the serializer (scene, scene_title, emoji, mood, ending, ending_label).
import { knotOf } from "./explorer";
import type { InkStory } from "./inkCompile";
import { tagValue } from "./inkTags";

export interface PassageChoice {
  index: number;
  text: string;
  emoji: string | null;
}

/** What the reader shows between two choices. */
export interface Passage {
  sceneId: string | null;
  sceneTitle: string | null;
  emoji: string | null;
  mood: string | null;
  /**
   * Text printed before the scene starts: the outcome of the choice just made (a transition).
   * Empty at the start, or for a passage without our scene tags.
   */
  transition: string[];
  paragraphs: string[];
  choices: PassageChoice[];
  /** Set when the story ended on one of our endings. */
  ending: { kind: string; label: string } | null;
  /**
   * Identifies the ending reached, to count discovered endings: the ending kind ("A"/"B")
   * for our stories; for an imported .ink without our tags (see `knots`), the knot where the
   * story stopped, the same rule as the explorer. Null while playing or on a dead end.
   */
  endingKey: string | null;
  /** The story stopped (ending, dead end or runtime error). */
  ended: boolean;
  /** inkjs runtime error, in which case `ended` is true. */
  error: string | null;
}

export interface PlayOptions {
  /**
   * Knots of an imported .ink (knotNamesFromSource). When given, a story that stops in a
   * passage without our tags counts as an ending, named after its knot.
   */
  knots?: string[];
}

/** Runs the story until the next choice (or the end) and describes what to show. */
function readPassage(story: InkStory, options: PlayOptions, fromKnot: string | null): Passage {
  const visits = () => (options.knots ?? []).map((k) => story.state.VisitCountAtPathString(k) ?? 0);
  const before = visits();
  const paragraphs: string[] = [];
  const tags: string[] = [];
  // Index of the first paragraph of the scene (the line carrying its `# scene:` tag).
  // Lines before it are the transition: the outcome of the choice just made.
  let sceneStart = -1;
  let error: string | null = null;
  try {
    while (story.canContinue) {
      const line = story.Continue()?.trim();
      const lineTags = story.currentTags ?? [];
      if (sceneStart === -1 && tagValue(lineTags, "scene")) sceneStart = paragraphs.length;
      if (line) paragraphs.push(line);
      tags.push(...lineTags);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e); // inkjs throws runtime errors
  }

  const endingKind = tagValue(tags, "ending");
  const choices = error
    ? []
    : story.currentChoices.map((choice) => ({
        index: choice.index,
        text: choice.text,
        emoji: tagValue(choice.tags ?? [], "emoji"),
      }));

  const ended = choices.length === 0;
  const after = visits();
  const enteredKnot = (options.knots ?? []).filter((_, i) => after[i] > before[i]).at(-1);
  let endingKey: string | null = null;
  if (endingKind) endingKey = endingKind;
  else if (ended && !error && options.knots && !tagValue(tags, "scene")) {
    endingKey = enteredKnot ?? fromKnot ?? "fin";
  }

  return {
    sceneId: tagValue(tags, "scene"),
    sceneTitle: tagValue(tags, "scene_title"),
    emoji: tagValue(tags, "emoji"),
    mood: tagValue(tags, "mood"),
    transition: sceneStart > 0 ? paragraphs.slice(0, sceneStart) : [],
    paragraphs: sceneStart > 0 ? paragraphs.slice(sceneStart) : paragraphs,
    choices,
    ending: endingKind ? { kind: endingKind, label: tagValue(tags, "ending_label") ?? "" } : null,
    endingKey,
    ended,
    error,
  };
}

/**
 * Starts the story from the beginning, or from a given scene ("Jouer depuis ici"):
 * ChoosePathString jumps to the knot with that name, which is the scene id.
 */
export function startStory(
  story: InkStory,
  fromSceneId?: string | null,
  options: PlayOptions = {},
): Passage {
  story.ResetState();
  if (fromSceneId) {
    try {
      story.ChoosePathString(fromSceneId);
    } catch {
      story.ResetState(); // unknown scene (e.g. deleted): start from the beginning
    }
  }
  return readPassage(story, options, null);
}

export function choose(story: InkStory, choiceIndex: number, options: PlayOptions = {}): Passage {
  const choice = story.currentChoices.find((c) => c.index === choiceIndex);
  const fromKnot = choice ? knotOf(choice.sourcePath) : null;
  story.ChooseChoiceIndex(choiceIndex);
  return readPassage(story, options, fromKnot);
}

/** The story's title, from the global `# title:` tag. */
export function storyTitle(story: InkStory): string | null {
  return tagValue(story.globalTags ?? [], "title");
}

// Playback engine for the Reader: drives the REAL compiled inkjs story, not the JSON.
// That is the point of the Reader: if a story plays here, the exported .ink works.
// Everything shown comes from the Ink itself: text from Continue(), and scene metadata
// from the tags written by the serializer (scene, scene_title, emoji, mood, ending, ending_label).
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
  paragraphs: string[];
  choices: PassageChoice[];
  /** Set when the story ended on one of our endings. */
  ending: { kind: string; label: string } | null;
  /** The story stopped (ending, dead end or runtime error). */
  ended: boolean;
  /** inkjs runtime error, in which case `ended` is true. */
  error: string | null;
}

/** Runs the story until the next choice (or the end) and describes what to show. */
function readPassage(story: InkStory): Passage {
  const paragraphs: string[] = [];
  const tags: string[] = [];
  let error: string | null = null;
  try {
    while (story.canContinue) {
      const line = story.Continue()?.trim();
      if (line) paragraphs.push(line);
      tags.push(...(story.currentTags ?? []));
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

  return {
    sceneId: tagValue(tags, "scene"),
    sceneTitle: tagValue(tags, "scene_title"),
    emoji: tagValue(tags, "emoji"),
    mood: tagValue(tags, "mood"),
    paragraphs,
    choices,
    ending: endingKind ? { kind: endingKind, label: tagValue(tags, "ending_label") ?? "" } : null,
    ended: choices.length === 0,
    error,
  };
}

/**
 * Starts the story from the beginning, or from a given scene ("Jouer depuis ici"):
 * ChoosePathString jumps to the knot with that name, which is the scene id.
 */
export function startStory(story: InkStory, fromSceneId?: string | null): Passage {
  story.ResetState();
  if (fromSceneId) {
    try {
      story.ChoosePathString(fromSceneId);
    } catch {
      story.ResetState(); // unknown scene (e.g. deleted): start from the beginning
    }
  }
  return readPassage(story);
}

export function choose(story: InkStory, choiceIndex: number): Passage {
  story.ChooseChoiceIndex(choiceIndex);
  return readPassage(story);
}

/** The story's title, from the global `# title:` tag. */
export function storyTitle(story: InkStory): string | null {
  return tagValue(story.globalTags ?? [], "title");
}

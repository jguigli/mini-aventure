// Deterministic JSON → Ink serializer.
// The JSON Story is the source of truth; the Ink text is always derived from it.
// Two guarantees matter here:
//   1. Any text the author or the LLM writes is escaped, so it can never be read as Ink syntax.
//   2. The output compiles even while the story is being edited (missing targets, scenes
//      without choices): problems are reported by validateStory, they do not break the editor.
import type { Choice, Scene, Story } from "@shared/schema";

// Characters that are always special in Ink, wherever they appear:
// choice brackets, logic braces, alternatives, tags and the escape character itself.
const ALWAYS_SPECIAL = /[[\]{}|#\\]/g;

/**
 * Escapes a single line of text so Ink outputs it literally.
 * In Ink, `\X` always produces `X`, so escaping is just adding a backslash.
 * We only escape where needed, so the exported .ink stays readable
 * (French has many hyphens: "peut-être", "dit-elle").
 */
export function escapeInk(line: string): string {
  let out = line.replace(ALWAYS_SPECIAL, "\\$&");
  // Two-character sequences: divert "->", thread "<-", glue "<>", comments "//" and "/*".
  out = out.replace(/-(?=>)/g, "\\-");
  out = out.replace(/<(?=[->])/g, "\\<");
  // Both characters of "//" and "/*" must be escaped: "\/*" still opens a block comment.
  out = out.replace(/\/(?=[/*])|(?<=\/)[/*]/g, "\\$&");
  // At the start of a line: choice (* +), gather (-), knot/stitch (=), logic (~).
  out = out.replace(/^(\s*)([*+\-=~])/, "$1\\$2");
  // A line starting with "TODO" is an author note in Ink, not text.
  out = out.replace(/^(\s*)TODO/, "$1\\TODO");
  return out;
}

/** Escapes a one-line value (choice label, tag value): newlines become spaces. */
function escapeInline(value: string): string {
  return escapeInk(value.replace(/\s*\n\s*/g, " ").trim());
}

/** Scene text: one Ink line per non-empty line, each one escaped. */
function textLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(escapeInk);
}

function choiceLine(choice: Choice, sceneIds: Set<string>): string {
  // Choice tags must be INSIDE the brackets to be attached to the choice
  // (a tag after "]" belongs to the text shown after choosing). Checked on inkjs 2.4.
  const emojiTag = choice.emoji.trim() ? ` #emoji: ${escapeInline(choice.emoji)}` : "";
  const label = `+ [${escapeInline(choice.label)}${emojiTag}]`;
  // Persistent "+" choices: they stay available when the reader comes back to a scene.
  if (sceneIds.has(choice.targetSceneId)) return `${label} -> ${choice.targetSceneId}`;
  // Missing target (new choice, deleted scene): end the story here so the Ink still compiles.
  // The explorer then reports this scene as a dead end, and validateStory names the problem.
  return `${label} -> END // destination manquante`;
}

function sceneBlock(scene: Scene, sceneIds: Set<string>): string {
  const lines = [
    `=== ${scene.id} ===`,
    `# scene: ${scene.id}`, // used by the explorer to know which scene it is in
    `# emoji: ${escapeInline(scene.emoji)}`,
    `# mood: ${scene.mood}`,
  ];
  if (scene.ending) {
    lines.push(`# ending: ${scene.ending.kind}`);
    lines.push(`# ending_label: ${escapeInline(scene.ending.label)}`);
  }
  lines.push(...textLines(scene.text));
  if (scene.choices.length > 0) {
    lines.push(...scene.choices.map((choice) => choiceLine(choice, sceneIds)));
  } else {
    // Endings, and scenes without choices yet, explicitly end the story.
    // Without this, Ink raises "ran out of content" at runtime.
    lines.push("-> END");
  }
  return lines.join("\n");
}

/** Converts a Story to Ink source text. Pure and deterministic: same input, same output. */
export function storyToInk(story: Story): string {
  const sceneIds = new Set(story.scenes.map((scene) => scene.id));
  // If the start scene is missing (edit in progress), fall back to the first scene.
  const start = sceneIds.has(story.startSceneId)
    ? story.startSceneId
    : (story.scenes[0]?.id ?? "END");

  const header = [
    `# title: ${escapeInline(story.title)}`,
    `# reading_level: ${story.readingLevel}`,
    "",
    `-> ${start}`,
  ].join("\n");

  return [header, ...story.scenes.map((scene) => sceneBlock(scene, sceneIds))].join("\n\n") + "\n";
}

// Everything the editor shows about a story's health, derived from the JSON in one pure call:
//   JSON → validateStory (structure) → storyToInk → compileInk (inkjs) → explore (plays every path).
// The editor runs it ~300 ms after each change. Problems warn, they never block.
import type { Story } from "@shared/schema";
import { validateStory, type ValidationIssue } from "@shared/validate";
import { explore, type ExploreResult } from "./explorer";
import { compileInk } from "./inkCompile";
import { storyToInk } from "./inkSerializer";

export interface StoryAnalysis {
  /** Structural issues found on the JSON. */
  issues: ValidationIssue[];
  issuesByScene: Map<string, ValidationIssue[]>;
  /** Ink source derived from the JSON (what "Exporter le .ink" downloads). */
  ink: string;
  compileErrors: string[];
  compileWarnings: string[];
  /** Result of playing every path of the compiled Ink, or null if it did not compile. */
  exploration: ExploreResult | null;
  /** Scenes never reached by the explorer (or by the graph check if the Ink did not compile). */
  unreachable: Set<string>;
  deadEnds: Set<string>;
  endingsReached: number;
  endingsTotal: number;
  /** True when there is nothing at all to report. */
  ok: boolean;
}

export function analyzeStory(story: Story): StoryAnalysis {
  const issues = validateStory(story);
  const issuesByScene = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    if (issue.sceneId)
      issuesByScene.set(issue.sceneId, [...(issuesByScene.get(issue.sceneId) ?? []), issue]);
  }

  const ink = storyToInk(story);
  const compiled = compileInk(ink);
  const exploration = compiled.story
    ? explore(compiled.story, { sceneIds: story.scenes.map((s) => s.id) })
    : null;

  // The explorer is the reference; without a compiled story, fall back on the graph check.
  const unreachable = new Set(
    exploration?.unreachedScenes ??
      issues.filter((i) => i.code === "unreachable").map((i) => i.sceneId!),
  );
  const deadEnds = new Set([
    ...(exploration?.deadEnds ?? []),
    ...issues.filter((i) => i.code === "dead_end").map((i) => i.sceneId!),
  ]);
  const endingsTotal = story.scenes.filter((s) => s.ending).length;
  const endingsReached = exploration?.reachedEndings.size ?? 0;

  const ok =
    issues.length === 0 &&
    compiled.errors.length === 0 &&
    exploration !== null &&
    unreachable.size === 0 &&
    deadEnds.size === 0 &&
    exploration.runtimeErrors.length === 0 &&
    !exploration.truncated;

  return {
    issues,
    issuesByScene,
    ink,
    compileErrors: compiled.errors,
    compileWarnings: compiled.warnings,
    exploration,
    unreachable,
    deadEnds,
    endingsReached,
    endingsTotal,
    ok,
  };
}

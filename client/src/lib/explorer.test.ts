import { describe, expect, it } from "vitest";
import { Story, type Story as StoryT } from "@shared/schema";
import examplePhare from "../../../examples/le-phare.json";
import { explore, knotNamesFromSource } from "./explorer";
import { compileInk } from "./inkCompile";
import { storyToInk } from "./inkSerializer";

const phare = () => Story.parse(structuredClone(examplePhare));

/** Serializes, compiles and explores a Story, using its scene ids as the expected scenes. */
function exploreStory(story: StoryT, maxSteps?: number) {
  const { story: ink, errors } = compileInk(storyToInk(story));
  expect(errors).toEqual([]);
  return explore(ink!, { sceneIds: story.scenes.map((s) => s.id), maxSteps });
}

function exploreSource(source: string) {
  const { story, errors } = compileInk(source);
  expect(errors).toEqual([]);
  return explore(story!, { sceneIds: knotNamesFromSource(source) });
}

describe("explore: generated stories", () => {
  it("reaches 100% of the example (including its sommet ↔ crique loop)", () => {
    const result = exploreStory(phare());
    expect([...result.reachedScenes].sort()).toEqual(
      ["carnet", "crique", "fin_brume", "fin_lumiere", "phare", "signal", "sommet"].sort(),
    );
    expect([...result.reachedEndings].sort()).toEqual(["A", "B"]);
    expect(result.unreachedScenes).toEqual([]);
    expect(result.deadEnds).toEqual([]);
    expect(result.runtimeErrors).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("explores each decision point once: the loop does not inflate the step count", () => {
    // 5 narrative scenes with 3+3+2+2+2 = 12 choices: each choice is taken exactly once.
    expect(exploreStory(phare()).steps).toBe(12);
  });

  it("terminates on a tight ping-pong loop with a small step budget", () => {
    const story = phare();
    // phare ↔ sommet: every scene can go back to the previous one.
    story.scenes[1].choices[2].targetSceneId = "phare";
    const result = exploreStory(story, 50);
    expect(result.truncated).toBe(false);
    expect(result.reachedEndings.size).toBe(2);
  });

  it("detects an orphan scene and a dead end precisely", () => {
    const story = phare();
    story.scenes.push({
      id: "grotte",
      title: "La grotte",
      emoji: "🕳️",
      mood: "mystere",
      text: "Personne ne vient jamais ici.",
      choices: [{ id: "c1", label: "Sortir", emoji: "🚪", targetSceneId: "phare" }],
      ending: null,
    });
    const carnet = story.scenes.find((s) => s.id === "carnet")!;
    carnet.choices = []; // non-ending scene without choices

    const result = exploreStory(story);
    expect(result.unreachedScenes).toEqual(["grotte"]);
    expect(result.deadEnds).toEqual(["carnet"]);
    expect(result.reachedEndings.size).toBe(2);
  });

  it("reports an ending that became unreachable", () => {
    const story = phare();
    // The only way to ending A is from the crique; redirect it to ending B.
    story.scenes.find((s) => s.id === "crique")!.choices[0].targetSceneId = "fin_brume";
    const result = exploreStory(story);
    expect([...result.reachedEndings]).toEqual(["B"]);
    expect(result.unreachedScenes).toEqual(["fin_lumiere"]);
  });

  it("reports the scene of a choice whose target is missing as a dead end", () => {
    const story = phare();
    story.scenes.find((s) => s.id === "signal")!.choices[1].targetSceneId = "supprimee";
    const result = exploreStory(story);
    expect(result.deadEnds).toEqual(["signal"]);
  });

  it("sets truncated when the step budget is too small", () => {
    const result = exploreStory(phare(), 3);
    expect(result.truncated).toBe(true);
    expect(result.steps).toBe(3);
  });

  it("leaves the story at its start state", () => {
    const { story } = compileInk(storyToInk(phare()));
    explore(story!);
    expect(story!.Continue()).toContain("Chaque soir");
  });
});

describe("explore: imported .ink without scene tags", () => {
  const imported = `VAR n = 0
-> hall
=== function double(x) ===
~ return x * 2
=== hall ===
Tu es dans le hall pour la {n}e fois.
~ n++
+ [Cuisine] -> cuisine
+ [Rester] -> hall
+ [Sortir] -> dehors
=== cuisine ===
= placard
Un placard.
+ [Retour] -> hall
+ [Manger] -> fin_repas
=== fin_repas ===
Miam.
-> END
=== dehors ===
Il pleut.
-> DONE
=== jamais ===
Jamais vu.
-> END
`;

  it("lists knots from the source, without functions", () => {
    expect(knotNamesFromSource(imported)).toEqual([
      "hall",
      "cuisine",
      "fin_repas",
      "dehors",
      "jamais",
    ]);
  });

  it("finds the distinct endings and the unreached knot, despite a counter that changes on each loop", () => {
    const result = exploreSource(imported);
    expect([...result.reachedEndings].sort()).toEqual(["dehors", "fin_repas"]);
    expect(result.unreachedScenes).toEqual(["jamais"]);
    expect(result.deadEnds).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("reports a runtime error as a dead end instead of crashing", () => {
    // "ran out of content": the knot has no -> END (a compile warning, a runtime error).
    const source =
      "-> a\n=== a ===\n+ [Aller en b] -> b\n+ [Finir] -> END\n=== b ===\nPlus rien.\n";
    const result = exploreSource(source);
    expect(result.runtimeErrors).toHaveLength(1);
    expect(result.deadEnds).toEqual(["b"]);
    expect(result.reachedEndings.size).toBe(1);
  });
});

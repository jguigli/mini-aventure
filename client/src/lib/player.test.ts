import { describe, expect, it } from "vitest";
import { Story, type Story as StoryT } from "@shared/schema";
import examplePhare from "../../../examples/le-phare.json";
import { compileInk, type InkStory } from "./inkCompile";
import { storyToInk } from "./inkSerializer";
import { choose, startStory, storyTitle } from "./player";
import { updateChoice } from "./storyEdits";

const phare = (): StoryT => Story.parse(structuredClone(examplePhare));
const compile = (story: StoryT): InkStory => compileInk(storyToInk(story)).story!;
const pick = (story: InkStory, passage: ReturnType<typeof startStory>, label: RegExp) => {
  const choice = passage.choices.find((c) => label.test(c.text));
  if (!choice) throw new Error(`no choice ${label} in ${passage.sceneId}`);
  return choose(story, choice.index);
};

describe("player (reads the compiled Ink, not the JSON)", () => {
  it("shows the first scene from the Ink tags", () => {
    const ink = compile(phare());
    const passage = startStory(ink);
    expect(passage).toMatchObject({
      sceneId: "phare",
      sceneTitle: "La voix dans la nuit",
      emoji: "🗼",
      mood: "mystere",
      ending: null,
      ended: false,
      error: null,
    });
    expect(passage.paragraphs[0]).toMatch(/^Chaque soir, Lina/);
    expect(passage.choices).toEqual([
      { index: 0, text: "Monter au sommet", emoji: "🪜" },
      { index: 1, text: "Descendre à la crique", emoji: "🏖️" },
    ]);
    expect(storyTitle(ink)).toBe("Le phare qui murmure");
  });

  it("plays to ending A and to ending B", () => {
    const ink = compile(phare());
    let passage = startStory(ink);
    passage = pick(ink, passage, /crique/);
    passage = pick(ink, passage, /Porter le coquillage/);
    expect(passage).toMatchObject({ sceneId: "fin_lumiere", ended: true, choices: [] });
    expect(passage.ending).toEqual({ kind: "A", label: "La voix libérée" });

    passage = startStory(ink); // « Rejouer »
    passage = pick(ink, passage, /crique/);
    passage = pick(ink, passage, /garder/);
    expect(passage.ending).toEqual({ kind: "B", label: "La voix perdue" });
  });

  it("shows the outcome of the choice as a transition, above the next scene", () => {
    const ink = compile(phare());
    const passage = pick(ink, startStory(ink), /crique/);
    expect(passage.transition).toEqual([
      "Lina descend le sentier glissant jusqu'à la petite crique.",
    ]);
    expect(passage.sceneTitle).toBe("Le coquillage qui chante");
    expect(passage.paragraphs[0]).toMatch(/^Les galets crissent/);
    expect(startStory(ink).transition).toEqual([]); // nothing before the first scene
  });

  it("starts from a given scene (« Jouer depuis ici »)", () => {
    const passage = startStory(compile(phare()), "carnet");
    expect(passage.sceneTitle).toBe("Le carnet du gardien");
    expect(passage.choices).toHaveLength(2);
  });

  it("falls back to the beginning for an unknown scene", () => {
    expect(startStory(compile(phare()), "supprimee").sceneId).toBe("phare");
  });

  it("reports a stop without an ending when a choice has no target", () => {
    const ink = compile(updateChoice(phare(), "phare", "c1", { targetSceneId: "" }));
    const passage = pick(ink, startStory(ink), /sommet/);
    expect(passage).toMatchObject({ ended: true, ending: null, error: null });
  });

  it("reports runtime errors instead of throwing", () => {
    const ink = compileInk("-> a\n=== a ===\n+ [Aller] -> b\n=== b ===\nPlus rien.\n").story!;
    const passage = choose(ink, startStory(ink).choices[0].index);
    expect(passage.ended).toBe(true);
    expect(passage.error).toMatch(/ran out of content/);
  });
});

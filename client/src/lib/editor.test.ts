import { describe, expect, it } from "vitest";
import { Story, type Story as StoryT } from "@shared/schema";
import examplePhare from "../../../examples/le-phare.json";
import { analyzeStory } from "./analysis";
import { fileBaseName } from "./download";
import { COLUMN_WIDTH, computeLayout } from "./layout";
import {
  applySceneRewrite,
  setLocked,
  addChoice,
  addScene,
  removeChoice,
  removeScene,
  slugify,
  uniqueSceneId,
  updateChoice,
  updateEndingLabel,
  updateScene,
} from "./storyEdits";

const phare = (): StoryT => Story.parse(structuredClone(examplePhare));

describe("computeLayout", () => {
  it("places scenes in columns by depth, endings in the last column", () => {
    const { columns, positions, unreachableColumn } = computeLayout(phare());
    expect(Object.fromEntries(columns)).toEqual({
      phare: 0,
      sommet: 1,
      crique: 1,
      signal: 2,
      carnet: 2,
      fin_lumiere: 3,
      fin_brume: 3,
    });
    expect(unreachableColumn).toBeNull();
    expect(positions.get("sommet")!.x).toBe(COLUMN_WIDTH);
    // Ending A above ending B.
    expect(positions.get("fin_lumiere")!.y).toBeLessThan(positions.get("fin_brume")!.y);
  });

  it("gives every scene a distinct position, centred around y = 0", () => {
    const { positions } = computeLayout(phare());
    const keys = [...positions.values()].map((p) => `${p.x},${p.y}`);
    expect(new Set(keys).size).toBe(7);
    expect(positions.get("phare")).toEqual({ x: 0, y: 0 });
  });

  it("puts unreachable scenes in a separate column after the endings", () => {
    const story = phare();
    story.scenes.push({ ...story.scenes[1], id: "grotte", title: "La grotte" });
    const { columns, unreachableColumn } = computeLayout(story);
    expect(unreachableColumn).toBe(4);
    expect(columns.get("grotte")).toBe(4);
  });

  it("keeps an unreachable ending in the endings column", () => {
    const story = updateChoice(phare(), "crique", "c1", { targetSceneId: "fin_brume" });
    const { columns, unreachableColumn } = computeLayout(story);
    expect(columns.get("fin_lumiere")).toBe(3);
    expect(unreachableColumn).toBeNull();
  });

  it("is deterministic", () => {
    expect(computeLayout(phare())).toEqual(computeLayout(phare()));
  });
});

describe("storyEdits", () => {
  it("slugifies titles into valid, unique scene ids", () => {
    expect(slugify("Le Phare d'été !")).toBe("le_phare_d_ete");
    expect(uniqueSceneId("Le phare", ["le_phare"])).toBe("le_phare_2");
    expect(uniqueSceneId("Le phare", ["le_phare", "le_phare_2"])).toBe("le_phare_3");
    expect(uniqueSceneId("42 étoiles", [])).toBe("scene_42_etoiles");
    expect(uniqueSceneId("End", [])).toBe("end_scene");
    expect(uniqueSceneId("!!!", [])).toBe("scene");
  });

  it("never mutates the input story", () => {
    const story = phare();
    const before = JSON.stringify(story);
    updateScene(story, "phare", { title: "X" });
    updateChoice(story, "phare", "c1", { label: "Y" });
    addChoice(story, "phare");
    removeChoice(story, "phare", "c1");
    addScene(story);
    removeScene(story, "sommet");
    updateEndingLabel(story, "fin_lumiere", "Z");
    expect(JSON.stringify(story)).toBe(before);
  });

  it("adds a choice with a fresh id and no target yet", () => {
    const { story, choiceId } = addChoice(phare(), "phare");
    expect(choiceId).toBe("c3");
    expect(story.scenes[0].choices.at(-1)).toMatchObject({ id: "c3", targetSceneId: "" });
    expect(addChoice(phare(), "fin_lumiere").choiceId).toBe(""); // no choices on an ending
  });

  it("adds a new, unconnected scene", () => {
    const { story, sceneId } = addScene(phare());
    expect(sceneId).toBe("nouvelle_scene");
    expect(story.scenes.at(-1)).toMatchObject({ id: "nouvelle_scene", choices: [], ending: null });
    expect(addScene(story).sceneId).toBe("nouvelle_scene_2");
  });

  it("removes a scene but keeps the choices that led to it", () => {
    const story = removeScene(phare(), "signal");
    expect(story.scenes.map((s) => s.id)).not.toContain("signal");
    expect(story.scenes.find((s) => s.id === "sommet")!.choices[0].targetSceneId).toBe("signal");
    expect(removeScene(phare(), "phare").scenes).toHaveLength(7); // the start scene stays
  });

  it("builds the export file name from the title", () => {
    expect(fileBaseName("Le phare qui murmure")).toBe("le-phare-qui-murmure");
    expect(fileBaseName("???")).toBe("aventure");
  });
});

describe("analyzeStory", () => {
  it("reports a clean story as ok", () => {
    const analysis = analyzeStory(phare());
    expect(analysis.ok).toBe(true);
    expect(analysis.endingsReached).toBe(2);
    expect(analysis.ink).toContain("=== phare ===");
  });

  it("flags an ending that becomes unreachable after a redirected choice (step 6 acceptance)", () => {
    // The only choice to ending A is "Porter le coquillage" in the crique: send it to ending B.
    const story = updateChoice(phare(), "crique", "c1", { targetSceneId: "fin_brume" });
    const analysis = analyzeStory(story);
    expect(analysis.ok).toBe(false);
    expect([...analysis.unreachable]).toEqual(["fin_lumiere"]);
    expect(analysis.endingsReached).toBe(1);
    expect(analysis.issuesByScene.get("fin_lumiere")?.[0].code).toBe("unreachable");
    expect(analysis.issuesByScene.get("crique")?.[0].code).toBe("duplicate_target");
  });

  it("flags a deleted scene: its incoming choices have a missing target", () => {
    const analysis = analyzeStory(removeScene(phare(), "signal"));
    expect(analysis.compileErrors).toEqual([]); // still compiles
    expect(analysis.deadEnds.has("sommet")).toBe(true);
    expect(analysis.issuesByScene.get("sommet")?.map((i) => i.code)).toContain("missing_target");
  });
});

describe("applySceneRewrite", () => {
  it("takes the words from the proposal but keeps ids, targets, ending kind and lock", () => {
    const story = setLocked(phare(), "crique", false);
    const next = applySceneRewrite(story, "crique", {
      title: "La flaque qui chante",
      emoji: "🐚",
      mood: "joie",
      text: "Nouveau texte.",
      // Even a proposal listing choices in another order cannot move an arrow.
      choices: [
        { id: "c3", label: "Remonter", emoji: "🗼" },
        { id: "c1", label: "Rendre aux vagues", emoji: "🌊" },
        { id: "c2", label: "Garder", emoji: "🎒" },
      ],
      endingLabel: null,
    });
    const crique = next.scenes.find((s) => s.id === "crique")!;
    expect(crique).toMatchObject({
      id: "crique",
      title: "La flaque qui chante",
      mood: "joie",
      text: "Nouveau texte.",
      ending: null,
    });
    expect(crique.choices.map((c) => [c.id, c.label, c.targetSceneId])).toEqual([
      ["c1", "Rendre aux vagues", "fin_lumiere"],
      ["c2", "Garder", "fin_brume"],
      ["c3", "Remonter", "sommet"],
    ]);
    expect(story.scenes.find((s) => s.id === "crique")!.title).toBe("Le coquillage qui chante"); // input untouched
  });

  it("keeps the ending kind and updates its label", () => {
    const next = applySceneRewrite(phare(), "fin_lumiere", {
      title: "T",
      emoji: "☀️",
      mood: "joie",
      text: "X",
      choices: [],
      endingLabel: "La sirène libre",
    });
    expect(next.scenes.find((s) => s.id === "fin_lumiere")!.ending).toEqual({
      kind: "A",
      label: "La sirène libre",
    });
  });

  it("locks and unlocks a scene", () => {
    expect(setLocked(phare(), "phare", true).scenes[0].locked).toBe(true);
  });
});

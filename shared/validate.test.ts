import { describe, expect, it } from "vitest";
import examplePhare from "../examples/le-phare.json";
// Real gpt-5.4-mini answer (step 4): passed every local check, but ending B had no way in.
import llmUnreachableEnding from "./fixtures/llm-unreachable-ending.json";
import { DEFAULT_EMOJI, isValidEmoji, normalizeEmoji, normalizeStoryEmojis } from "./emoji";
import { Story, type Story as StoryT } from "./schema";
import { isValidSceneId, validateStory } from "./validate";

const phare = (): StoryT => Story.parse(structuredClone(examplePhare));
const messages = (story: StoryT) => validateStory(story).map((i) => i.message);

describe("validateStory", () => {
  it("accepts the example", () => {
    expect(validateStory(phare())).toEqual([]);
  });

  it("rejects invalid, reserved and duplicate scene ids", () => {
    const story = phare();
    story.scenes[1].id = "Sommet"; // uppercase
    story.scenes[2].id = "not"; // reserved
    story.scenes[3].id = "phare"; // duplicate
    const issues = validateStory(story);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sceneId: "Sommet",
          message: expect.stringContaining("invalide"),
        }),
        expect.objectContaining({
          sceneId: "not",
          message: expect.stringContaining("mot réservé"),
        }),
        expect.objectContaining({
          sceneId: "phare",
          message: expect.stringContaining("deux fois"),
        }),
      ]),
    );
  });

  it("reports missing targets with the scene and choice", () => {
    const story = phare();
    story.scenes[0].choices[0].targetSceneId = "supprimee";
    story.scenes[0].choices[1].targetSceneId = "";
    const issues = validateStory(story).filter((i) =>
      i.message.startsWith("Destination manquante"),
    );
    expect(issues).toEqual([
      expect.objectContaining({ sceneId: "phare", choiceId: "c1" }),
      expect.objectContaining({ sceneId: "phare", choiceId: "c2" }),
    ]);
  });

  it("reports a missing start scene", () => {
    const story = phare();
    story.startSceneId = "ailleurs";
    expect(messages(story)).toContainEqual(expect.stringContaining("scène de départ « ailleurs »"));
  });

  it("requires exactly two endings, A and B", () => {
    const story = phare();
    story.scenes.find((s) => s.id === "fin_brume")!.ending!.kind = "A";
    expect(messages(story)).toContainEqual(expect.stringContaining("exactement 2 fins"));
  });

  it("reports a dead end and an ending with choices", () => {
    const story = phare();
    story.scenes.find((s) => s.id === "carnet")!.choices = [];
    story.scenes.find((s) => s.id === "fin_brume")!.choices = [
      { id: "c1", label: "Recommencer", emoji: "🔁", targetSceneId: "phare" },
    ];
    const issues = validateStory(story);
    expect(issues).toContainEqual(
      expect.objectContaining({ sceneId: "carnet", message: expect.stringContaining("Impasse") }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        sceneId: "fin_brume",
        message: expect.stringContaining("ne doit pas proposer"),
      }),
    );
  });

  it("enforces 2 to 3 choices per narrative scene", () => {
    const story = phare();
    story.scenes[0].choices = story.scenes[0].choices.slice(0, 1);
    expect(validateStory(story)).toContainEqual(
      expect.objectContaining({ sceneId: "phare", message: expect.stringContaining("1 choix") }),
    );
  });

  it("enforces 4 to 6 narrative scenes", () => {
    const story = phare();
    story.scenes = story.scenes.filter((s) => s.id !== "signal" && s.id !== "carnet");
    story.scenes.find((s) => s.id === "sommet")!.choices = [
      { id: "c1", label: "Courir", emoji: "🪨", targetSceneId: "crique" },
      { id: "c2", label: "Redescendre", emoji: "🪜", targetSceneId: "phare" },
    ];
    expect(messages(story)).toContainEqual(expect.stringContaining("3 scènes narratives"));
  });

  it("reports invalid emojis", () => {
    const story = phare();
    story.scenes[0].emoji = "phare";
    story.scenes[0].choices[0].emoji = "🪜🌊";
    const issues = validateStory(story).filter((i) => i.message.includes("emoji"));
    expect(issues).toHaveLength(2);
  });

  it("reports an empty story", () => {
    const story = phare();
    story.scenes = [];
    expect(messages(story)).toEqual(["L'histoire ne contient aucune scène."]);
  });
});

describe("validateStory: graph checks", () => {
  it("catches the real LLM answer whose ending B could not be reached", () => {
    const issues = validateStory(Story.parse(llmUnreachableEnding));
    expect(issues).toContainEqual({
      sceneId: "coin_perdu",
      message: "La fin B n'est jamais atteinte : aucun chemin n'y mène depuis la scène de départ.",
    });
    // Same answer: "coin clair" and "coin chaud" both led to the same scene.
    expect(issues).toContainEqual(
      expect.objectContaining({
        sceneId: "plan_courbe",
        choiceId: "c2",
        message: expect.stringContaining("tous les deux"),
      }),
    );
  });

  it("reports an orphan scene", () => {
    const story = phare();
    story.scenes.find((s) => s.id === "phare")!.choices[0].targetSceneId = "crique"; // nothing leads to sommet anymore
    story.scenes.find((s) => s.id === "phare")!.choices[1].targetSceneId = "carnet";
    story.scenes.find((s) => s.id === "crique")!.choices[2].targetSceneId = "phare"; // was "Remonter au sommet"
    const issues = validateStory(story);
    expect(issues).toContainEqual(
      expect.objectContaining({
        sceneId: "sommet",
        message: expect.stringContaining("jamais atteinte"),
      }),
    );
  });

  it("reports scenes trapped in a loop with no way to an ending", () => {
    const story = phare();
    // signal and carnet only lead to each other.
    story.scenes.find((s) => s.id === "signal")!.choices = [
      { id: "c1", label: "Lire le carnet", emoji: "📓", targetSceneId: "carnet" },
      { id: "c2", label: "Revenir au phare", emoji: "🗼", targetSceneId: "phare" },
    ];
    story.scenes.find((s) => s.id === "signal")!.choices[1].targetSceneId = "carnet";
    story.scenes.find((s) => s.id === "carnet")!.choices = [
      { id: "c1", label: "Faire un signal", emoji: "🏮", targetSceneId: "signal" },
      { id: "c2", label: "Relire", emoji: "🔁", targetSceneId: "signal" },
    ];
    const trapped = validateStory(story)
      .filter((i) => i.message.includes("tourne en rond"))
      .map((i) => i.sceneId);
    expect(trapped.sort()).toEqual(["carnet", "signal"]);
  });
});

describe("isValidSceneId", () => {
  it.each(["phare", "fin_a", "scene2"])("accepts %s", (id) =>
    expect(isValidSceneId(id)).toBe(true),
  );
  it.each(["", "Phare", "2scene", "fin-a", "phare_à", "end", "true", "function"])(
    "rejects %s",
    (id) => expect(isValidSceneId(id)).toBe(false),
  );
});

describe("emoji", () => {
  it.each(["🗼", "🏖️", "☀️", "👩‍🚀", "🕳️"])("accepts the single emoji %s", (e) =>
    expect(isValidEmoji(e)).toBe(true),
  );
  it.each(["", "a", "🗼🌊", "★ ok", "phare"])("rejects %s", (e) =>
    expect(isValidEmoji(e)).toBe(false),
  );

  it("keeps the first emoji, or falls back to 📖", () => {
    expect(normalizeEmoji("🗼🌊")).toBe("🗼");
    expect(normalizeEmoji(" 👩‍🚀 ")).toBe("👩‍🚀");
    expect(normalizeEmoji("phare")).toBe(DEFAULT_EMOJI);
    expect(normalizeEmoji("")).toBe(DEFAULT_EMOJI);
  });

  it("normalizes every emoji of a story", () => {
    const story = phare();
    story.scenes[0].emoji = "rien";
    story.scenes[0].choices[0].emoji = "🪜🪜";
    const fixed = normalizeStoryEmojis(story);
    expect(fixed.scenes[0].emoji).toBe(DEFAULT_EMOJI);
    expect(fixed.scenes[0].choices[0].emoji).toBe("🪜");
    expect(validateStory(fixed)).toEqual([]);
    expect(story.scenes[0].emoji).toBe("rien"); // input not mutated
  });
});

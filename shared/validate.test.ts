import { describe, expect, it } from "vitest";
import examplePhare from "../examples/le-phare.json";
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

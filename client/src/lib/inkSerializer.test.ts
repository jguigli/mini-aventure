import { describe, expect, it } from "vitest";
import { Story, type Scene, type Story as StoryT } from "@shared/schema";
import examplePhare from "../../../examples/le-phare.json";
import { compileInk, type InkStory } from "./inkCompile";
import { storyToInk } from "./inkSerializer";

const phare = Story.parse(examplePhare);

/** Reads everything up to the next choice; returns the text and all tags seen on the way. */
function readAll(story: InkStory): { text: string; tags: string[] } {
  let text = "";
  const tags: string[] = [];
  while (story.canContinue) {
    text += story.Continue();
    tags.push(...(story.currentTags ?? []));
  }
  return { text, tags };
}

function compileOrFail(story: StoryT): InkStory {
  const result = compileInk(storyToInk(story));
  expect(result.errors).toEqual([]);
  expect(result.story).not.toBeNull();
  return result.story!;
}

/** Minimal valid-enough story: one scene with one choice to an ending. */
function tinyStory(start: Partial<Scene> = {}): StoryT {
  return {
    plan: { summary: "", endingA: "", endingB: "" },
    title: "Test",
    readingLevel: "11-12",
    startSceneId: "debut",
    scenes: [
      {
        id: "debut",
        title: "Début",
        emoji: "🚪",
        mood: "calme",
        text: "Bonjour.",
        choices: [{ id: "c1", label: "Continuer", emoji: "👣", targetSceneId: "fin" }],
        ending: null,
        ...start,
      },
      {
        id: "fin",
        title: "Fin",
        emoji: "🏁",
        mood: "joie",
        text: "Fin.",
        choices: [],
        ending: { kind: "A", label: "La fin" },
      },
    ],
  };
}

describe("example le-phare", () => {
  it("is a valid Story", () => {
    expect(phare.scenes).toHaveLength(7);
  });

  it("serializes and compiles without errors or warnings", () => {
    const result = compileInk(storyToInk(phare));
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("matches the committed examples/le-phare.ink (run `vitest -u` to update it)", async () => {
    await expect(storyToInk(phare)).toMatchFileSnapshot("../../../examples/le-phare.ink");
  });

  it("exposes scene tags and choice emojis to the runtime", () => {
    const story = compileOrFail(phare);
    const { tags } = readAll(story);
    expect(tags).toEqual(
      expect.arrayContaining([
        "scene: phare",
        "emoji: 🗼",
        "mood: mystere",
        "title: Le phare qui murmure",
      ]),
    );
    expect(story.currentChoices.map((c) => c.text)).toEqual([
      "Monter au sommet",
      "Descendre à la crique",
    ]);
    expect(story.currentChoices.map((c) => c.tags)).toEqual([["emoji: 🪜"], ["emoji: 🏖️"]]);
  });

  it("can be played to ending A", () => {
    const story = compileOrFail(phare);
    readAll(story);
    story.ChooseChoiceIndex(1); // Descendre à la crique
    expect(readAll(story).tags).toContain("scene: crique");
    story.ChooseChoiceIndex(0); // Porter le coquillage jusqu'aux vagues
    const { tags } = readAll(story);
    expect(tags).toEqual(expect.arrayContaining(["scene: fin_lumiere", "ending: A"]));
    expect(story.currentChoices).toHaveLength(0);
    expect(story.canContinue).toBe(false);
  });
});

describe("escaping", () => {
  // Each of these would be read as Ink syntax if it were not escaped.
  const tricky = [
    "Des [crochets] et des {accolades}.",
    "Un a | b et un # dièse.",
    "Une flèche -> ici et un fil <- là.",
    "De la colle <> au milieu.",
    "Pas un // commentaire.",
    "Pas un /* bloc */ non plus.",
    "Un antislash \\ tout seul.",
    "- Un tiret en début de ligne.",
    "* Une étoile en début de ligne.",
    "+ Un plus en début de ligne.",
    "= Un égal en début de ligne.",
    "~ Un tilde en début de ligne.",
    "TODO: pas une note d'auteur.",
    "Peut-être, dit-elle, à l'arc-en-ciel : « oui » !",
    "a = b, x * y, 3 - 2 et 1 + 1.",
  ];

  it.each(tricky)("scene text round-trips unchanged: %s", (line) => {
    const story = compileOrFail(tinyStory({ text: line }));
    expect(readAll(story).text.trim()).toBe(line);
  });

  it.each(tricky)("choice label round-trips unchanged: %s", (line) => {
    const story = compileOrFail(
      tinyStory({ choices: [{ id: "c1", label: line, emoji: "👣", targetSceneId: "fin" }] }),
    );
    readAll(story);
    expect(story.currentChoices[0].text).toBe(line);
    expect(story.currentChoices[0].tags).toEqual(["emoji: 👣"]);
  });

  it("keeps multi-line text as separate lines, without empty lines", () => {
    const story = compileOrFail(tinyStory({ text: "Ligne une.\n\n  Ligne deux.  \n" }));
    expect(readAll(story).text).toBe("Ligne une.\nLigne deux.\n");
  });

  it("escapes tag values (ending label, title)", () => {
    const base = tinyStory();
    base.title = "Titre # [spécial]";
    base.scenes[1].ending = { kind: "A", label: "Fin # 1 // [ok]" };
    const story = compileOrFail(base);
    expect(story.globalTags).toEqual(["title: Titre # [spécial]", "reading_level: 11-12"]);
    readAll(story);
    story.ChooseChoiceIndex(0);
    expect(readAll(story).tags).toContain("ending_label: Fin # 1 // [ok]");
  });
});

describe("choice outcomes (the sentence shown right after a choice)", () => {
  it("prints the outcome after the click, as its own line before the next scene", () => {
    const story = compileOrFail(
      tinyStory({
        choices: [
          {
            id: "c1",
            label: "Continuer",
            emoji: "👣",
            targetSceneId: "fin",
            outcome: "Il avance -> doucement [vraiment].",
          },
        ],
      }),
    );
    readAll(story);
    expect(story.currentChoices[0].text).toBe("Continuer"); // not part of the button
    story.ChooseChoiceIndex(0);
    const lines: string[] = [];
    while (story.canContinue) lines.push(story.Continue()!);
    expect(lines).toEqual(["Il avance -> doucement [vraiment].\n", "Fin.\n"]);
  });

  it("compiles an outcome on a choice whose target is missing", () => {
    compileOrFail(
      tinyStory({
        choices: [{ id: "c1", label: "X", emoji: "👣", targetSceneId: "", outcome: "Il hésite." }],
      }),
    );
  });
});

describe("robustness while editing", () => {
  it("compiles a choice whose target does not exist, and ends the story there", () => {
    const story = compileOrFail(
      tinyStory({
        choices: [{ id: "c1", label: "Vers nulle part", emoji: "❓", targetSceneId: "supprimee" }],
      }),
    );
    readAll(story);
    story.ChooseChoiceIndex(0);
    readAll(story);
    expect(story.canContinue).toBe(false);
    expect(story.currentChoices).toHaveLength(0);
  });

  it("compiles a choice with an empty target", () => {
    compileOrFail(
      tinyStory({ choices: [{ id: "c1", label: "Nouveau choix", emoji: "", targetSceneId: "" }] }),
    );
  });

  it("compiles a non-ending scene without choices (a dead end)", () => {
    const story = compileOrFail(tinyStory({ choices: [] }));
    readAll(story);
    expect(story.canContinue).toBe(false);
    expect(story.currentChoices).toHaveLength(0);
  });

  it("falls back to the first scene when the start scene is missing", () => {
    const base = tinyStory();
    base.startSceneId = "inexistante";
    expect(readAll(compileOrFail(base)).tags).toContain("scene: debut");
  });

  it("compiles a story with no scenes", () => {
    const base = tinyStory();
    base.scenes = [];
    compileOrFail(base);
  });
});

describe("compileInk", () => {
  it("returns errors instead of throwing on invalid Ink", () => {
    const result = compileInk("-> nulle_part\n");
    expect(result.story).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("nulle_part");
  });
});

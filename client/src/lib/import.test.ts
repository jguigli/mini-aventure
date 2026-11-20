// Import / export round trips, and the public example from inkle's documentation.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { Story } from "@shared/schema";
import examplePhare from "../../../examples/le-phare.json";
import { MAX_DEPTH, explore, knotNamesFromSource } from "./explorer";
import { compileInk } from "./inkCompile";
import { storyToInk } from "./inkSerializer";
import { choose, startStory } from "./player";

const fogg = fs.readFileSync(
  new URL("../../../examples/monsieur-fogg.ink", import.meta.url),
  "utf8",
);

describe("re-importing our own export", () => {
  const exported = storyToInk(Story.parse(examplePhare));

  it("compiles, lists the same scenes, and explores at 100%", () => {
    const { story, errors } = compileInk(exported);
    expect(errors).toEqual([]);
    const knots = knotNamesFromSource(exported);
    expect(knots).toEqual(Story.parse(examplePhare).scenes.map((s) => s.id));
    const result = explore(story!, { sceneIds: knots });
    expect([...result.reachedEndings].sort()).toEqual(["A", "B"]);
    expect(result.unreachedScenes).toEqual([]);
    expect(result.deadEnds).toEqual([]);
  });

  it("exports a compiled JSON that inkjs can load back", () => {
    const json = compileInk(exported).story!.ToJson()!;
    expect(JSON.parse(json)).toHaveProperty("inkVersion");
  });
});

describe("public example: Monsieur Fogg (inkle, MIT)", () => {
  it("keeps its source and license in a header comment", () => {
    expect(fogg).toContain("Source: https://github.com/inkle/ink/blob/");
    expect(fogg).toContain("License: MIT");
  });

  it("compiles and explores: no knots, one ending, no dead end", () => {
    const { story, errors } = compileInk(fogg);
    expect(errors).toEqual([]);
    expect(knotNamesFromSource(fogg)).toEqual([]);
    const result = explore(story!, { sceneIds: [] });
    expect(result.reachedEndings.size).toBe(1);
    expect(result.deadEnds).toEqual([]);
    expect(result.runtimeErrors).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("plays the documentation's short playthrough and counts it as an ending", () => {
    const { story } = compileInk(fogg);
    const options = { knots: [] };
    let passage = startStory(story!, null, options);
    expect(passage.paragraphs).toEqual(["I looked at Monsieur Fogg"]);
    expect(passage.choices.map((c) => c.text)).toEqual([
      "... and I could contain myself no longer.",
      "... but I said nothing",
    ]);
    passage = choose(story!, passage.choices[1].index, options);
    expect(passage.paragraphs).toEqual([
      "... but I said nothing and we passed the day in silence.",
    ]);
    expect(passage.ended).toBe(true);
    expect(passage.endingKey).not.toBeNull();
  });
});

describe("explorer depth guard", () => {
  it("stops a very long chain with `truncated` instead of overflowing the stack", () => {
    const n = MAX_DEPTH + 50;
    const knots = Array.from(
      { length: n },
      (_, i) =>
        `=== k${i} ===\nÉtape ${i}.\n+ [Continuer] -> ${i + 1 < n ? `k${i + 1}` : "END"}\n+ [Rester] -> k${i}`,
    );
    const source = `-> k0\n${knots.join("\n")}\n`;
    const { story } = compileInk(source);
    const result = explore(story!, { sceneIds: knotNamesFromSource(source) });
    expect(result.truncated).toBe(true);
  });
});

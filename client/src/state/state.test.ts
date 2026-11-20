import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Story, type Story as StoryT } from "@shared/schema";
import examplePhare from "../../../examples/le-phare.json";
import {
  AUTOSAVE_DELAY_MS,
  STORAGE_KEY,
  clearSavedStory,
  loadSavedStory,
  saveStory,
  startAutosave,
  type StorageLike,
} from "./autosave";
import {
  COALESCE_MS,
  UNDO_LIMIT,
  applyEdit,
  createStoryStore,
  loadStory,
  redo,
  undo,
} from "./storyStore";
import { isEditableTarget, undoActionFor } from "./useUndoShortcuts";

const phare = (): StoryT => Story.parse(structuredClone(examplePhare));
const titled = (story: StoryT, title: string): StoryT => ({ ...story, title });

describe("undo history", () => {
  it("undoes and redoes discrete edits one by one", () => {
    let h = loadStory(phare());
    h = applyEdit(h, titled(h.present!, "Un"));
    h = applyEdit(h, titled(h.present!, "Deux"));
    expect(h.past).toHaveLength(2);

    h = undo(h);
    expect(h.present!.title).toBe("Un");
    h = undo(h);
    expect(h.present!.title).toBe("Le phare qui murmure");
    expect(undo(h)).toBe(h); // nothing left to undo

    h = redo(h);
    expect(h.present!.title).toBe("Un");
  });

  it("merges keystrokes in the same field into one undo step", () => {
    let h = loadStory(phare());
    let now = 0;
    for (const title of ["L", "Le", "Le r", "Le ro", "Le robot"]) {
      now += 200; // typing: 200 ms between keys
      h = applyEdit(h, titled(h.present!, title), { coalesceKey: "title", now });
    }
    expect(h.past).toHaveLength(1);
    expect(undo(h).present!.title).toBe("Le phare qui murmure");
  });

  it("starts a new undo step after a pause or in another field", () => {
    let h = loadStory(phare());
    h = applyEdit(h, titled(h.present!, "A"), { coalesceKey: "title", now: 0 });
    h = applyEdit(h, titled(h.present!, "AB"), { coalesceKey: "title", now: COALESCE_MS + 1 });
    expect(h.past).toHaveLength(2); // pause > 1 s

    const other = { ...h.present!, startSceneId: "sommet" };
    h = applyEdit(h, other, { coalesceKey: "start", now: COALESCE_MS + 2 });
    expect(h.past).toHaveLength(3); // other field
  });

  it("clears the redo branch on a new edit", () => {
    let h = loadStory(phare());
    h = applyEdit(h, titled(h.present!, "Un"));
    h = undo(h);
    h = applyEdit(h, titled(h.present!, "Autre"));
    expect(h.future).toEqual([]);
  });

  it(`keeps at most ${UNDO_LIMIT} undo steps`, () => {
    let h = loadStory(phare());
    for (let i = 0; i < UNDO_LIMIT + 10; i++) h = applyEdit(h, titled(h.present!, `T${i}`));
    expect(h.past).toHaveLength(UNDO_LIMIT);
  });

  it("store: load resets the history and notifies subscribers", () => {
    const store = createStoryStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.load(phare());
    store.edit((s) => titled(s, "Nouveau"));
    expect(store.getState().past).toHaveLength(1);
    store.load(phare());
    expect(store.getState().past).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

/** In-memory Storage, optionally broken. */
function fakeStorage(broken = false): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  const fail = () => {
    throw new Error("QuotaExceededError");
  };
  return {
    data,
    getItem: (key) => (broken ? fail() : (data.get(key) ?? null)),
    setItem: (key, value) => (broken ? fail() : void data.set(key, value)),
    removeItem: (key) => (broken ? fail() : void data.delete(key)),
  };
}

describe("autosave", () => {
  it("saves and reads back a story under the versioned key", () => {
    const storage = fakeStorage();
    expect(saveStory(phare(), storage, new Date("2026-11-20T10:00:00Z"))).toBe(true);
    expect([...storage.data.keys()]).toEqual([STORAGE_KEY]);
    expect(loadSavedStory(storage)).toEqual({
      story: phare(),
      savedAt: "2026-11-20T10:00:00.000Z",
    });
    clearSavedStory(storage);
    expect(loadSavedStory(storage)).toBeNull();
  });

  it("never throws on corrupted data or unavailable storage", () => {
    const storage = fakeStorage();
    storage.data.set(STORAGE_KEY, "{pas du json");
    expect(loadSavedStory(storage)).toBeNull();
    storage.data.set(STORAGE_KEY, JSON.stringify({ story: { title: 42 }, savedAt: "x" }));
    expect(loadSavedStory(storage)).toBeNull();

    const broken = fakeStorage(true);
    expect(saveStory(phare(), broken)).toBe(false);
    expect(loadSavedStory(broken)).toBeNull();
    expect(() => clearSavedStory(broken)).not.toThrow();
    expect(loadSavedStory(null)).toBeNull();
  });

  describe("startAutosave", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("writes once, ~500 ms after a burst of edits, and reports it", () => {
      const storage = fakeStorage();
      const store = createStoryStore();
      const onSaved = vi.fn();
      const stop = startAutosave(store, onSaved, AUTOSAVE_DELAY_MS, storage);

      store.load(phare());
      store.edit((s) => titled(s, "Le r"), { coalesceKey: "title" });
      store.edit((s) => titled(s, "Le robot"), { coalesceKey: "title" });
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
      expect(onSaved).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(onSaved.mock.calls[0][0]).toBe(true);
      expect(loadSavedStory(storage)!.story.title).toBe("Le robot");
      stop();
    });

    it("does not save when the story is cleared, and stops cleanly", () => {
      const storage = fakeStorage();
      const store = createStoryStore();
      const onSaved = vi.fn();
      const stop = startAutosave(store, onSaved, AUTOSAVE_DELAY_MS, storage);
      store.clear();
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
      expect(onSaved).not.toHaveBeenCalled();

      stop();
      store.load(phare());
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
      expect(onSaved).not.toHaveBeenCalled();
    });

    it("reports a failed save instead of crashing", () => {
      const store = createStoryStore();
      const onSaved = vi.fn();
      startAutosave(store, onSaved, AUTOSAVE_DELAY_MS, fakeStorage(true));
      store.load(phare());
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
      expect(onSaved.mock.calls[0][0]).toBe(false);
    });
  });
});

describe("undo shortcuts", () => {
  const key = (
    k: string,
    mods: Partial<{ ctrl: boolean; meta: boolean; shift: boolean; alt: boolean }> = {},
  ) => ({
    key: k,
    ctrlKey: !!mods.ctrl,
    metaKey: !!mods.meta,
    shiftKey: !!mods.shift,
    altKey: !!mods.alt,
  });

  it("maps Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y", () => {
    expect(undoActionFor(key("z", { ctrl: true }))).toBe("undo");
    expect(undoActionFor(key("z", { meta: true }))).toBe("undo");
    expect(undoActionFor(key("Z", { ctrl: true, shift: true }))).toBe("redo");
    expect(undoActionFor(key("y", { ctrl: true }))).toBe("redo");
    expect(undoActionFor(key("z"))).toBeNull();
    expect(undoActionFor(key("z", { ctrl: true, alt: true }))).toBeNull();
    expect(undoActionFor(key("s", { ctrl: true }))).toBeNull();
  });

  it("leaves text fields to the browser's own undo", () => {
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isEditableTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

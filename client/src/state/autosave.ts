// Autosave of the current story in localStorage, so a page refresh never loses work.
// Rules:
//   - one versioned key; only the story is saved, not the undo history;
//   - every read and write is wrapped in try/catch: storage can be full, disabled
//     (private mode) or hold corrupted data, and none of that may crash the app;
//   - a saved story is validated with zod before being offered back.
import { Story } from "@shared/schema";
import type { StoryStore } from "./storyStore";

export const STORAGE_KEY = "mini-aventure:v1";
export const AUTOSAVE_DELAY_MS = 500;

export interface SavedStory {
  story: Story;
  savedAt: string; // ISO date
}

/** Subset of the Storage API we use (lets tests pass an in-memory fake). */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return window.localStorage; // throws in some privacy modes, undefined outside a browser
  } catch {
    return null;
  }
}

/** Saves the story. Returns false if storage is unavailable or full. */
export function saveStory(
  story: Story,
  storage: StorageLike | null = defaultStorage(),
  now = new Date(),
): boolean {
  if (!storage) return false;
  try {
    const file: SavedStory = { story, savedAt: now.toISOString() };
    storage.setItem(STORAGE_KEY, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

/** Reads the saved story, or null if there is none or it is unreadable. */
export function loadSavedStory(storage: StorageLike | null = defaultStorage()): SavedStory | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SavedStory>;
    const story = Story.safeParse(data.story);
    if (!story.success || typeof data.savedAt !== "string") return null;
    return { story: story.data, savedAt: data.savedAt };
  } catch {
    return null; // corrupted JSON: ignore it, the next save overwrites it
  }
}

export function clearSavedStory(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // nothing to do: storage unavailable
  }
}

/**
 * Saves the store's story ~500 ms after each change (debounced: a burst of keystrokes
 * gives a single write). Also flushes a pending save when the page is being closed.
 * Returns a function that stops the autosave.
 */
export function startAutosave(
  store: StoryStore,
  onSaved: (ok: boolean, at: Date) => void,
  delay = AUTOSAVE_DELAY_MS,
  storage: StorageLike | null = defaultStorage(),
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSaved = store.getState().present;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const story = store.getState().present;
    if (!story || story === lastSaved) return;
    lastSaved = story;
    const at = new Date();
    onSaved(saveStory(story, storage, at), at);
  };

  const unsubscribe = store.subscribe(() => {
    const story = store.getState().present;
    if (!story || story === lastSaved) return; // cleared, or nothing new to save
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  });

  const onPageHide = () => flush();
  globalThis.addEventListener?.("pagehide", onPageHide);

  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
    globalThis.removeEventListener?.("pagehide", onPageHide);
  };
}

// Current story + undo/redo history.
// The JSON Story is the single source of truth of the app: every screen reads it from here,
// and every change goes through `edit`, which records it in the undo history.
//
// History = snapshots of the whole Story (past / present / future). Stories are small
// (a few KB), so copies are simpler and safer than recording individual operations.
import { useSyncExternalStore } from "react";
import type { Story } from "@shared/schema";

/** Maximum number of undo steps kept. */
export const UNDO_LIMIT = 50;
/** Edits to the same field closer than this are merged into one undo step. */
export const COALESCE_MS = 1000;

export interface StoryHistory {
  past: Story[];
  present: Story | null;
  future: Story[];
  /** Last edit, used to merge successive keystrokes in the same field. */
  lastEdit: { key: string; at: number } | null;
}

export interface EditOptions {
  /**
   * Identifies the field being edited (e.g. "title", "scene:phare:text").
   * Successive edits with the same key, less than COALESCE_MS apart, become ONE undo step:
   * typing a sentence is undone in one go, not letter by letter.
   * Discrete actions (add/remove a choice, change a target) pass no key: one step each.
   */
  coalesceKey?: string;
  /** Current time, injectable for tests. */
  now?: number;
}

export const emptyHistory: StoryHistory = { past: [], present: null, future: [], lastEdit: null };

/** A new story (generated, example, resumed): fresh history, nothing to undo. */
export function loadStory(story: Story): StoryHistory {
  return { past: [], present: story, future: [], lastEdit: null };
}

export function applyEdit(
  history: StoryHistory,
  next: Story,
  options: EditOptions = {},
): StoryHistory {
  if (!history.present) return loadStory(next);
  if (next === history.present) return history;

  const now = options.now ?? Date.now();
  const { coalesceKey } = options;
  const merge =
    coalesceKey !== undefined &&
    history.lastEdit?.key === coalesceKey &&
    now - history.lastEdit.at < COALESCE_MS;

  return {
    // Merging: the previous snapshot is already in `past`, only `present` moves on.
    past: merge ? history.past : [...history.past, history.present].slice(-UNDO_LIMIT),
    present: next,
    future: [], // a new edit makes the redo branch obsolete
    lastEdit: coalesceKey !== undefined ? { key: coalesceKey, at: now } : null,
  };
}

export function undo(history: StoryHistory): StoryHistory {
  const previous = history.past.at(-1);
  if (!previous || !history.present) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastEdit: null,
  };
}

export function redo(history: StoryHistory): StoryHistory {
  const [next, ...rest] = history.future;
  if (!next || !history.present) return history;
  return { past: [...history.past, history.present], present: next, future: rest, lastEdit: null };
}

/** Minimal observable store around the pure functions above (no state library needed). */
export function createStoryStore(initial: StoryHistory = emptyHistory) {
  let state = initial;
  const listeners = new Set<() => void>();
  const set = (next: StoryHistory) => {
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener());
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load: (story: Story) => set(loadStory(story)),
    clear: () => set(emptyHistory),
    /** Changes the current story; `update` receives the current story and returns a new one. */
    edit(update: (story: Story) => Story, options?: EditOptions) {
      if (state.present) set(applyEdit(state, update(state.present), options));
    },
    undo: () => set(undo(state)),
    redo: () => set(redo(state)),
  };
}

export type StoryStore = ReturnType<typeof createStoryStore>;

/** The app's single store. */
export const storyStore = createStoryStore();

/** React hook: re-renders when the history changes. */
export function useStoryHistory(store: StoryStore = storyStore): StoryHistory {
  return useSyncExternalStore(store.subscribe, store.getState);
}

// Global Ctrl+Z / Ctrl+Shift+Z (Cmd on macOS) for the story history.
// When the focus is in a text field, we do NOTHING: the browser's own undo for that
// field is what the author expects while typing. The app's undo applies everywhere else.
import { useEffect } from "react";
import type { StoryStore } from "./storyStore";

interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** "undo", "redo" or null for a keyboard event. Ctrl+Y is also accepted for redo. */
export function undoActionFor(event: KeyLike): "undo" | "redo" | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && !event.shiftKey) return "redo";
  return null;
}

/** True for elements that have their own undo (text inputs, textareas, selects, contenteditable). */
export function isEditableTarget(target: unknown): boolean {
  const element = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!element || typeof element.tagName !== "string") return false;
  return (
    element.isContentEditable === true || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)
  );
}

export function useUndoShortcuts(store: StoryStore): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const action = undoActionFor(event);
      if (!action) return;
      event.preventDefault();
      store[action]();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store]);
}

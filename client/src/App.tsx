// App root: one store holds the current story; the screen follows from it
// (no story → creation screen, a story → editor).
import { useCallback, useEffect, useState } from "react";
import { API_HEALTH_PATH, type HealthResponse } from "@shared/api";
import type { Story } from "@shared/schema";
import type { SaveStatus } from "./components/SavedIndicator";
import { Create } from "./screens/Create";
import { Editor } from "./screens/Editor";
import { ImportScreen, type ImportedInk } from "./screens/ImportScreen";
import { clearSavedStory, loadSavedStory, startAutosave } from "./state/autosave";
import { storyStore, useStoryHistory } from "./state/storyStore";
import { useUndoShortcuts } from "./state/useUndoShortcuts";

export default function App() {
  const history = useStoryHistory();
  // Read once at startup: the resume banner offers it, nothing is loaded without the author's choice.
  const [saved, setSaved] = useState(loadSavedStory);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  // Number of issues the AI left in the story it just generated (shown once in the editor).
  const [generationWarnings, setGenerationWarnings] = useState(0);
  // An imported .ink (text mode). Separate from the story store: not autosaved, no undo history.
  const [imported, setImported] = useState<ImportedInk | null>(null);
  // Endings found in Lecture, kept in memory for the session (reset when another story opens).
  const [discoveredEndings, setDiscoveredEndings] = useState<Set<string>>(new Set());
  const onEndingDiscovered = useCallback(
    (kind: string) =>
      setDiscoveredEndings((found) => (found.has(kind) ? found : new Set(found).add(kind))),
    [],
  );

  useUndoShortcuts(storyStore);
  useEffect(() => startAutosave(storyStore, (ok, at) => setSaveStatus({ ok, at })), []);

  useEffect(() => {
    fetch(API_HEALTH_PATH)
      .then((res) => (res.ok ? (res.json() as Promise<HealthResponse>) : null))
      .then((health) => setHasApiKey(health ? health.openaiKey : null))
      .catch(() => setHasApiKey(null)); // server down: the generate call will say so
  }, []);

  const openStory = (story: Story, warnings = 0) => {
    setSaveStatus(null);
    setGenerationWarnings(warnings);
    setDiscoveredEndings(new Set());
    storyStore.load(story);
  };

  if (history.present) {
    return (
      <Editor
        history={{ ...history, present: history.present }}
        saveStatus={saveStatus}
        generationWarnings={generationWarnings}
        onDismissWarnings={() => setGenerationWarnings(0)}
        discoveredEndings={discoveredEndings}
        onEndingDiscovered={onEndingDiscovered}
        onLeave={() => {
          // Back to the home screen; the autosave is kept and offered in the resume banner.
          setSaved(loadSavedStory());
          storyStore.clear();
        }}
      />
    );
  }

  if (imported) {
    return <ImportScreen file={imported} onLeave={() => setImported(null)} />;
  }

  return (
    <Create
      onImport={setImported}
      saved={saved}
      hasApiKey={hasApiKey}
      onStory={openStory}
      onResume={() => saved && openStory(saved.story)}
      onDiscardSaved={() => {
        clearSavedStory();
        setSaved(null);
      }}
    />
  );
}

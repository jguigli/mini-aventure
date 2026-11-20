// App root: one store holds the current story; the screen follows from it
// (no story → creation screen, a story → editor).
import { useEffect, useState } from "react";
import { API_HEALTH_PATH, type HealthResponse } from "@shared/api";
import type { Story } from "@shared/schema";
import type { SaveStatus } from "./components/SavedIndicator";
import { Create } from "./screens/Create";
import { Editor } from "./screens/Editor";
import { clearSavedStory, loadSavedStory, startAutosave } from "./state/autosave";
import { storyStore, useStoryHistory } from "./state/storyStore";
import { useUndoShortcuts } from "./state/useUndoShortcuts";

export default function App() {
  const history = useStoryHistory();
  // Read once at startup: the resume banner offers it, nothing is loaded without the author's choice.
  const [saved, setSaved] = useState(loadSavedStory);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useUndoShortcuts(storyStore);
  useEffect(() => startAutosave(storyStore, (ok, at) => setSaveStatus({ ok, at })), []);

  useEffect(() => {
    fetch(API_HEALTH_PATH)
      .then((res) => (res.ok ? (res.json() as Promise<HealthResponse>) : null))
      .then((health) => setHasApiKey(health ? health.openaiKey : null))
      .catch(() => setHasApiKey(null)); // server down: the generate call will say so
  }, []);

  const openStory = (story: Story) => {
    setSaveStatus(null);
    storyStore.load(story);
  };

  if (history.present) {
    return (
      <Editor
        history={{ ...history, present: history.present }}
        saveStatus={saveStatus}
        onLeave={() => {
          // Back to the home screen; the autosave is kept and offered in the resume banner.
          setSaved(loadSavedStory());
          storyStore.clear();
        }}
      />
    );
  }

  return (
    <Create
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

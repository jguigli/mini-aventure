// Story screen with two modes sharing one header and one bottom bar:
//   - Édition: map + quick test, side panel (scene editor or verification report);
//   - Lecture: the Reader, which plays the compiled Ink.
// The JSON in storyStore is the source of truth; the map, the checks, the Reader and the
// exported .ink are all derived from it. Switching modes keeps the current scene.
import { useState } from "react";
import type { Story } from "@shared/schema";
import { QuickTest } from "../components/QuickTest";
import { ExportBar } from "../components/ExportBar";
import type { SaveStatus } from "../components/SavedIndicator";
import { ScenePanel } from "../components/ScenePanel";
import { StoryMap } from "../components/StoryMap";
import { VerificationPanel } from "../components/VerificationPanel";
import { storyToInk } from "../lib/inkSerializer";
import { storyStore, type StoryHistory } from "../state/storyStore";
import { useStoryAnalysis } from "../state/useStoryAnalysis";
import { Reader } from "./Reader";

interface Props {
  history: StoryHistory & { present: Story };
  saveStatus: SaveStatus | null;
  onLeave: () => void;
  /** Issues the AI left after its retry (shown once, as a banner). */
  generationWarnings: number;
  onDismissWarnings: () => void;
  /** Endings found in Lecture during this session. */
  discoveredEndings: Set<string>;
  onEndingDiscovered: (kind: string) => void;
}

export function Editor({
  history,
  saveStatus,
  onLeave,
  generationWarnings,
  onDismissWarnings,
  discoveredEndings,
  onEndingDiscovered,
}: Props) {
  const story = history.present;
  const { analysis, pending, checkNow } = useStoryAnalysis(story);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "read">("edit");
  // Lecture: where to start, and the scene currently read (to come back to it in Édition).
  const [readFrom, setReadFrom] = useState<string | null>(null);
  const [readingScene, setReadingScene] = useState<string | null>(null);

  const openReader = (sceneId: string | null) => {
    setReadFrom(sceneId);
    setReadingScene(sceneId);
    setMode("read");
  };
  const openEditor = (sceneId: string | null) => {
    setSelectedId(sceneId);
    setMode("edit");
  };
  // Quick test: path of scene ids from the start, and the edges taken ("scene:choice").
  const [testPath, setTestPath] = useState<string[]>([story.startSceneId]);
  const [testEdges, setTestEdges] = useState<Set<string>>(new Set());

  const selected = story.scenes.find((s) => s.id === selectedId) ?? null;
  // If the scene the test is on disappears (deleted, undone), restart the test.
  const path = story.scenes.some((s) => s.id === testPath.at(-1)) ? testPath : [story.startSceneId];

  const resetTest = () => {
    setTestPath([story.startSceneId]);
    setTestEdges(new Set());
  };

  return (
    <div className="app-shell editor-shell">
      <header className="app-header">
        <button type="button" className="button-link" onClick={onLeave}>
          ← Accueil
        </button>
        <label className="title-field">
          <span className="visually-hidden">Titre de l'histoire</span>
          <input
            value={story.title}
            onChange={(event) =>
              storyStore.edit((s) => ({ ...s, title: event.target.value }), {
                coalesceKey: "title",
              })
            }
          />
        </label>
        <div className="mode-toggle" role="group" aria-label="Mode">
          <button
            type="button"
            aria-pressed={mode === "edit"}
            className={mode === "edit" ? "is-active" : undefined}
            onClick={() => mode === "read" && openEditor(readingScene)}
          >
            ✏️ Édition
          </button>
          <button
            type="button"
            aria-pressed={mode === "read"}
            className={mode === "read" ? "is-active" : undefined}
            onClick={() => mode === "edit" && openReader(selectedId)}
          >
            📖 Lecture
          </button>
        </div>
        <button
          type="button"
          className={`button-secondary check-button ${analysis.ok ? "is-ok" : "is-warn"}`}
          onClick={() => {
            checkNow();
            openEditor(null);
          }}
        >
          {analysis.ok ? "✅ Vérifier" : "⚠️ Vérifier"}
        </button>
        <div className="header-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={storyStore.undo}
            disabled={history.past.length === 0}
            title="Annuler (Ctrl+Z)"
            aria-label="Annuler"
          >
            ↶
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={storyStore.redo}
            disabled={history.future.length === 0}
            title="Rétablir (Ctrl+Shift+Z)"
            aria-label="Rétablir"
          >
            ↷
          </button>
        </div>
      </header>

      {generationWarnings > 0 && (
        <div className="notice notice-warn editor-notice" role="status">
          <p>
            L'IA a laissé {generationWarnings} problème{generationWarnings > 1 ? "s" : ""} qu'elle
            n'a pas su corriger. {generationWarnings > 1 ? "Ils sont signalés" : "Il est signalé"}{" "}
            ⚠️ sur la carte : corrige-
            {generationWarnings > 1 ? "les" : "le"} ici avant d'exporter.
          </p>
          <button type="button" className="button-link" onClick={onDismissWarnings}>
            Compris
          </button>
        </div>
      )}

      {mode === "read" ? (
        <Reader
          story={story}
          startFrom={readFrom}
          onScene={setReadingScene}
          onEditScene={openEditor}
          discoveredEndings={discoveredEndings}
          onEndingDiscovered={onEndingDiscovered}
          totalEndings={analysis.endingsTotal}
        />
      ) : (
        <main className="editor-main">
          <div className="editor-map-column">
            <StoryMap
              story={story}
              analysis={analysis}
              selectedId={selectedId}
              onSelect={setSelectedId}
              testPath={path}
              testEdges={testEdges}
            />
            <QuickTest
              story={story}
              path={path}
              onReset={resetTest}
              onChoose={(sceneId, choiceId, targetId) => {
                setTestPath([...path, targetId]);
                setTestEdges(new Set(testEdges).add(`${sceneId}:${choiceId}`));
              }}
            />
          </div>
          <aside className="side-panel">
            {selected ? (
              <ScenePanel
                key={selected.id}
                story={story}
                scene={selected}
                issues={analysis.issuesByScene.get(selected.id) ?? []}
                onSelect={setSelectedId}
                onPlayFrom={openReader}
              />
            ) : (
              <VerificationPanel
                story={story}
                analysis={analysis}
                pending={pending}
                onSelect={setSelectedId}
              />
            )}
          </aside>
        </main>
      )}

      <ExportBar
        getInk={() => storyToInk(storyStore.getState().present ?? story)}
        title={story.title}
        saveStatus={saveStatus}
        quiet={mode === "read"}
      />
    </div>
  );
}

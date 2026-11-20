// Step 5: temporary story screen, so a generated story can be seen, renamed, undone and resumed.
// Step 6 replaces the scene list with the map and the side panel; the header and the
// bottom bar stay.
import type { Story } from "@shared/schema";
import { SavedIndicator, type SaveStatus } from "../components/SavedIndicator";
import { storyStore, type StoryHistory } from "../state/storyStore";

interface Props {
  history: StoryHistory & { present: Story };
  saveStatus: SaveStatus | null;
  onLeave: () => void;
}

export function Editor({ history, saveStatus, onLeave }: Props) {
  const story = history.present;

  return (
    <div className="app-shell">
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
        <div className="header-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={storyStore.undo}
            disabled={history.past.length === 0}
            title="Annuler (Ctrl+Z)"
          >
            ↶ Annuler
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={storyStore.redo}
            disabled={history.future.length === 0}
            title="Rétablir (Ctrl+Shift+Z)"
          >
            ↷ Rétablir
          </button>
        </div>
      </header>

      <main className="app-main">
        <ol className="scene-list">
          {story.scenes.map((scene) => (
            <li key={scene.id} className={`scene-item mood-${scene.mood}`}>
              <span className="scene-emoji" aria-hidden="true">
                {scene.emoji}
              </span>
              <div>
                <p className="scene-title">
                  {scene.title}
                  {scene.ending && <span className="ending-badge">Fin {scene.ending.kind}</span>}
                </p>
                <p className="scene-text">{scene.text}</p>
                {scene.choices.length > 0 && (
                  <ul className="choice-list">
                    {scene.choices.map((choice) => (
                      <li key={choice.id}>
                        <span aria-hidden="true">{choice.emoji}</span> {choice.label} →{" "}
                        <code>{choice.targetSceneId}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      </main>

      <footer className="action-bar">
        <span className="action-bar-hint">
          Carte, lecture et export arrivent aux étapes suivantes.
        </span>
        <SavedIndicator status={saveStatus} />
      </footer>
    </div>
  );
}

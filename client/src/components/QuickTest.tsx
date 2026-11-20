// Quick test under the map: walk through the story by clicking choices; the path lights up
// on the map. It follows the JSON (a structural check while editing); the real playback
// on the compiled Ink is the Reader (step 7).
import type { Story } from "@shared/schema";

interface Props {
  story: Story;
  path: string[];
  onChoose: (sceneId: string, choiceId: string, targetId: string) => void;
  onReset: () => void;
}

export function QuickTest({ story, path, onChoose, onReset }: Props) {
  const ids = new Set(story.scenes.map((s) => s.id));
  const current = story.scenes.find((s) => s.id === path.at(-1));

  return (
    <section className="quick-test" aria-label="Test rapide">
      <span className="quick-test-label">Test rapide</span>
      {current ? (
        <>
          <span className="quick-test-scene">
            <span aria-hidden="true">{current.emoji}</span> {current.title}
          </span>
          <span className="quick-test-choices">
            {current.ending ? (
              <strong>
                Fin {current.ending.kind} : {current.ending.label}
              </strong>
            ) : current.choices.length === 0 ? (
              <em>Impasse : aucun choix.</em>
            ) : (
              current.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className="button-secondary button-small"
                  disabled={!ids.has(choice.targetSceneId)}
                  title={ids.has(choice.targetSceneId) ? undefined : "Destination manquante"}
                  onClick={() => onChoose(current.id, choice.id, choice.targetSceneId)}
                >
                  <span aria-hidden="true">{choice.emoji}</span> {choice.label}
                </button>
              ))
            )}
          </span>
        </>
      ) : (
        <em>La scène de départ est introuvable.</em>
      )}
      <button type="button" className="button-link" onClick={onReset} disabled={path.length <= 1}>
        Réinitialiser
      </button>
    </section>
  );
}

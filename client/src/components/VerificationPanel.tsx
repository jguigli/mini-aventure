// Verification report, shown in the side panel when no scene is selected (« Vérifier »).
// Two independent checks, presented separately on purpose:
//   1. Structure: validateStory on the JSON;
//   2. Paths played by inkjs: the explorer on the compiled Ink.
import type { Story } from "@shared/schema";
import type { StoryAnalysis } from "../lib/analysis";

interface Props {
  story: Story;
  analysis: StoryAnalysis;
  pending: boolean;
  onSelect: (sceneId: string) => void;
}

export function VerificationPanel({ story, analysis, pending, onSelect }: Props) {
  const title = (id: string) => {
    const scene = story.scenes.find((s) => s.id === id);
    return scene ? `${scene.emoji} ${scene.title}` : id;
  };
  const exploration = analysis.exploration;
  const reached = exploration
    ? story.scenes.filter((s) => exploration.reachedScenes.has(s.id)).length
    : 0;

  return (
    <div className="verification-panel" aria-live="polite">
      <div className="panel-heading">
        <h2>Vérification</h2>
        {pending && <span className="muted">mise à jour…</span>}
      </div>

      <p className={`verdict ${analysis.ok ? "verdict-ok" : "verdict-warn"}`}>
        {analysis.ok
          ? "✅ Tout est en ordre : chaque scène et les deux fins sont atteignables."
          : "⚠️ Il reste des problèmes. Ils n'empêchent pas de continuer, mais corrige-les avant d'exporter."}
      </p>

      <h3>Parcours joué par inkjs</h3>
      {analysis.compileErrors.length > 0 ? (
        <ul className="issue-list">
          {analysis.compileErrors.map((error, i) => (
            <li key={i}>⛔ {error}</li>
          ))}
        </ul>
      ) : (
        exploration && (
          <ul className="check-list">
            <li>
              Scènes atteintes : {reached}/{story.scenes.length}
            </li>
            <li>
              Fins atteintes : {analysis.endingsReached}/{analysis.endingsTotal}
            </li>
            {[...analysis.unreachable].map((id) => (
              <li key={`u-${id}`}>
                ⚠️ Jamais atteinte :{" "}
                <button type="button" className="button-link" onClick={() => onSelect(id)}>
                  {title(id)}
                </button>
              </li>
            ))}
            {[...analysis.deadEnds].map((id) => (
              <li key={`d-${id}`}>
                ⚠️ L'histoire s'arrête sans fin :{" "}
                <button type="button" className="button-link" onClick={() => onSelect(id)}>
                  {title(id)}
                </button>
              </li>
            ))}
            {exploration.runtimeErrors.map((error, i) => (
              <li key={`r-${i}`}>⛔ {error}</li>
            ))}
            {exploration.truncated && (
              <li>⚠️ Exploration interrompue : l'histoire est trop grande.</li>
            )}
          </ul>
        )
      )}

      <h3>Structure</h3>
      {analysis.issues.length === 0 ? (
        <p className="muted">Aucun problème.</p>
      ) : (
        <ul className="issue-list">
          {analysis.issues.map((issue, i) => (
            <li key={i}>
              {issue.sceneId ? (
                <button
                  type="button"
                  className="button-link"
                  onClick={() => onSelect(issue.sceneId!)}
                >
                  {title(issue.sceneId)}
                </button>
              ) : (
                <strong>Histoire</strong>
              )}{" "}
              : {issue.message}
            </li>
          ))}
        </ul>
      )}

      <p className="muted panel-tip">Clique sur une scène de la carte pour la modifier.</p>
    </div>
  );
}

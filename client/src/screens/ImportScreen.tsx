// Text mode for an imported .ink: a plain text editor and the player side by side, with the
// explorer's results. No map: rebuilding our JSON structure from arbitrary Ink is out of
// scope (an assumed choice), but any .ink can be checked, played, edited and exported.
// The imported file lives in its own state: it is not autosaved and has no undo history
// (the textarea has the browser's own undo).
import { useCallback, useEffect, useMemo, useState } from "react";
import { InkPlayer } from "../components/InkPlayer";
import { ExportBar } from "../components/ExportBar";
import { explore, knotNamesFromSource } from "../lib/explorer";
import { compileInk } from "../lib/inkCompile";
import { storyTitle } from "../lib/player";

export interface ImportedInk {
  source: string;
  fileName: string;
}

const RECOMPILE_DELAY_MS = 400;

interface Props {
  file: ImportedInk;
  onLeave: () => void;
}

export function ImportScreen({ file, onLeave }: Props) {
  const [source, setSource] = useState(file.source);
  // Compile and explore ~400 ms after the last keystroke, not on every key.
  const [checkedSource, setCheckedSource] = useState(file.source);
  useEffect(() => {
    if (source === checkedSource) return;
    const timer = setTimeout(() => setCheckedSource(source), RECOMPILE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [source, checkedSource]);

  const knots = useMemo(() => knotNamesFromSource(checkedSource), [checkedSource]);
  // Two compiled instances on purpose: the explorer resets the state of the story it plays,
  // so it must never run on the one the player is using.
  const analysis = useMemo(() => {
    const compiled = compileInk(checkedSource);
    const exploration = compiled.story ? explore(compiled.story, { sceneIds: knots }) : null;
    return { ...compiled, exploration };
  }, [checkedSource, knots]);
  const playerInk = useMemo(() => compileInk(checkedSource).story, [checkedSource]);
  const playOptions = useMemo(() => ({ knots }), [knots]);

  const [discovered, setDiscovered] = useState<Set<string>>(new Set());
  const onEndingDiscovered = useCallback(
    (key: string) => setDiscovered((found) => (found.has(key) ? found : new Set(found).add(key))),
    [],
  );

  const title = (playerInk && storyTitle(playerInk)) || file.fileName.replace(/\.ink$/i, "");
  const exploration = analysis.exploration;
  const modified = source !== file.source;

  const leave = () => {
    if (
      !modified ||
      window.confirm(
        "Le fichier importé n'est pas sauvegardé. Quitter quand même ? (Exporte-le d'abord pour garder tes modifications.)",
      )
    ) {
      onLeave();
    }
  };

  return (
    <div className="app-shell editor-shell">
      <header className="app-header">
        <button type="button" className="button-link" onClick={leave}>
          ← Accueil
        </button>
        <h1 className="import-title">{title}</h1>
        <span className="tag tag-muted">Fichier importé · mode texte</span>
      </header>

      <main className="import-main">
        <section className="import-editor" aria-label="Code Ink">
          <label className="field">
            <span>
              {file.fileName}
              {modified && " (modifié)"}
            </span>
            <textarea
              className="code-editor"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              spellCheck={false}
            />
          </label>

          <div className="import-report" aria-live="polite">
            <h2>Vérification</h2>
            {analysis.errors.length > 0 ? (
              <ul className="issue-list">
                {analysis.errors.map((error, i) => (
                  <li key={i}>⛔ {error}</li>
                ))}
              </ul>
            ) : (
              exploration && (
                <ul className="check-list">
                  {knots.length > 0 && (
                    <li>
                      Knots atteints : {knots.length - exploration.unreachedScenes.length}/
                      {knots.length}
                    </li>
                  )}
                  <li>Fins atteintes : {exploration.reachedEndings.size}</li>
                  {exploration.unreachedScenes.map((knot) => (
                    <li key={`u-${knot}`}>
                      ⚠️ Jamais atteint : <code>{knot}</code>
                    </li>
                  ))}
                  {exploration.deadEnds.map((knot) => (
                    <li key={`d-${knot}`}>
                      ⚠️ Impasse : <code>{knot}</code>
                    </li>
                  ))}
                  {exploration.runtimeErrors.map((error, i) => (
                    <li key={`r-${i}`}>⛔ {error}</li>
                  ))}
                  {exploration.truncated && (
                    <li>
                      ⚠️ Exploration interrompue : l'histoire est trop grande ou trop complexe.
                    </li>
                  )}
                </ul>
              )
            )}
            {analysis.warnings.length > 0 && (
              <details>
                <summary>{analysis.warnings.length} avertissement(s) du compilateur</summary>
                <ul className="check-list">
                  {analysis.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </details>
            )}
            <p className="muted">
              Avec des variables ou des conditions, l'exploration est approximative : une branche
              qui ne s'ouvre que sous condition peut être manquée.
            </p>
          </div>
        </section>

        <section className="import-player" aria-label="Lecture">
          {playerInk ? (
            <InkPlayer
              ink={playerInk}
              playOptions={playOptions}
              discoveredEndings={discovered}
              onEndingDiscovered={onEndingDiscovered}
              totalEndings={exploration?.reachedEndings.size ?? 0}
              className="is-embedded"
            />
          ) : (
            <p className="notice notice-error">
              L'histoire ne compile pas : corrige les erreurs à gauche.
            </p>
          )}
        </section>
      </main>

      <ExportBar getInk={() => source} title={title} showCodeItem={false} />
    </div>
  );
}

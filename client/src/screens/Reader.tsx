// Read mode: a clean, full-screen player for the REAL compiled inkjs story.
// It never reads the JSON to play: text, choices and metadata all come from the Ink,
// which proves that the exported .ink works.
// Keyboard: Tab / Enter on the choices, or the number keys 1-9.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Story } from "@shared/schema";
import { compileInk } from "../lib/inkCompile";
import { storyToInk } from "../lib/inkSerializer";
import { choose, startStory, storyTitle, type Passage } from "../lib/player";
import { isEditableTarget } from "../state/useUndoShortcuts";

interface Props {
  story: Story;
  /** Scene to start from (« Jouer depuis ici », or the scene selected in Édition). */
  startFrom: string | null;
  /** Reports the scene being read, so going back to Édition keeps it selected. */
  onScene: (sceneId: string | null) => void;
  /** « ✏️ Modifier cette scène ». */
  onEditScene: (sceneId: string | null) => void;
  /** Endings found during this session (kept by the app, not saved). */
  discoveredEndings: Set<string>;
  onEndingDiscovered: (kind: string) => void;
  totalEndings: number;
}

export function Reader({
  story,
  startFrom,
  onScene,
  onEditScene,
  discoveredEndings,
  onEndingDiscovered,
  totalEndings,
}: Props) {
  const compiled = useMemo(() => compileInk(storyToInk(story)), [story]);
  const [state, setState] = useState(() => ({
    compiled,
    passage: compiled.story ? startStory(compiled.story, startFrom) : null,
  }));

  // The story changed while reading (e.g. Ctrl+Z): recompile and resume at the same scene.
  if (state.compiled !== compiled) {
    const sceneId = state.passage?.sceneId ?? startFrom;
    setState({ compiled, passage: compiled.story ? startStory(compiled.story, sceneId) : null });
  }

  const passage = state.passage;
  const ink = compiled.story;
  const actions = useRef<HTMLDivElement>(null);

  const show = (next: Passage) => {
    setState({ compiled, passage: next });
    onScene(next.sceneId);
  };
  const pick = (index: number) => ink && show(choose(ink, index));
  // Latest `pick` for the keyboard listener (avoids re-subscribing on every render).
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });
  const replay = () => ink && show(startStory(ink));

  // Record the ending as discovered (for « Fins découvertes : x/2 »).
  const endingKind = passage?.ending?.kind;
  useEffect(() => {
    if (endingKind) onEndingDiscovered(endingKind);
  }, [endingKind, onEndingDiscovered]);

  // Keyboard flow: after each step, focus the first choice (or « Rejouer » at the end).
  useEffect(() => {
    actions.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [passage]);

  // Number keys 1-9 pick a choice.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      const n = Number(event.key);
      const choice = passage?.choices[n - 1];
      if (Number.isInteger(n) && choice) {
        event.preventDefault();
        pickRef.current(choice.index);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [passage]);

  if (!ink || !passage) {
    return (
      <main className="reader">
        <article className="reader-card">
          <h2>L'histoire ne compile pas</h2>
          <ul className="issue-list">
            {compiled.errors.map((error, i) => (
              <li key={i}>⛔ {error}</li>
            ))}
          </ul>
          <button type="button" className="button-primary" onClick={() => onEditScene(null)}>
            Retour à l'édition
          </button>
        </article>
      </main>
    );
  }

  const title = storyTitle(ink);
  // Count the ending on screen right away (the session list is updated just after render).
  const endingsFound = new Set([...discoveredEndings, ...(endingKind ? [endingKind] : [])]).size;

  return (
    <main
      className={`reader reader-mood-${passage.ending ? `ending-${passage.ending.kind.toLowerCase()}` : passage.mood}`}
    >
      <article className="reader-card">
        {title && <p className="reader-story-title">{title}</p>}

        <div aria-live="polite">
          {passage.emoji && (
            <p className="reader-emoji" aria-hidden="true">
              {passage.emoji}
            </p>
          )}
          {passage.sceneTitle && <h2 className="reader-scene-title">{passage.sceneTitle}</h2>}
          <div className="reader-text">
            {passage.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>

        <div className="reader-actions" ref={actions}>
          {passage.choices.map((choice, i) => (
            <button
              key={choice.index}
              type="button"
              className="reader-choice"
              onClick={() => pick(choice.index)}
            >
              {choice.emoji && (
                <span className="reader-choice-emoji" aria-hidden="true">
                  {choice.emoji}
                </span>
              )}
              <span className="reader-choice-text">{choice.text}</span>
              {i < 9 && (
                <kbd className="reader-choice-key" aria-hidden="true">
                  {i + 1}
                </kbd>
              )}
            </button>
          ))}

          {passage.ended && (
            <div className="reader-end">
              {passage.ending ? (
                <p className={`reader-ending ending-${passage.ending.kind.toLowerCase()}`}>
                  Fin {passage.ending.kind} : {passage.ending.label}
                </p>
              ) : (
                <p className="reader-ending is-broken">
                  {passage.error
                    ? `Erreur dans l'histoire : ${passage.error}`
                    : "L'histoire s'arrête ici sans fin : un choix ne mène nulle part."}
                </p>
              )}
              <button type="button" className="button-primary button-large" onClick={replay}>
                🔁 Rejouer
              </button>
              <p className="reader-endings-count">
                Fins découvertes : {endingsFound}/{totalEndings}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          className="button-link reader-edit"
          onClick={() => onEditScene(passage.sceneId)}
        >
          ✏️ Modifier cette scène
        </button>
      </article>
    </main>
  );
}

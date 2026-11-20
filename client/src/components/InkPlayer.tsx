// Player card for a compiled inkjs story. Used by the Reader (our stories) and by the
// import screen (any .ink). It only reads the Ink: text from Continue(), metadata from tags.
// Keyboard: Tab / Enter on the choices, or the number keys 1-9.
import { useEffect, useRef, useState } from "react";
import type { InkStory } from "../lib/inkCompile";
import { choose, startStory, storyTitle, type Passage, type PlayOptions } from "../lib/player";
import { isEditableTarget } from "../state/useUndoShortcuts";

interface Props {
  ink: InkStory;
  /** Scene (knot) to start from, or null for the beginning. */
  startFrom?: string | null;
  /** Knots of an imported .ink: lets untagged endings be recognised (see player.ts). */
  playOptions?: PlayOptions;
  /** Reports the scene being read. */
  onScene?: (sceneId: string | null) => void;
  /** « ✏️ Modifier cette scène »; the link is hidden when not provided. */
  onEditScene?: (sceneId: string | null) => void;
  discoveredEndings: Set<string>;
  onEndingDiscovered: (key: string) => void;
  totalEndings: number;
  /** Move the focus to the first choice when the player opens (full-screen Reader). */
  autoFocus?: boolean;
  className?: string;
}

export function InkPlayer({
  ink,
  startFrom = null,
  playOptions = {},
  onScene,
  onEditScene,
  discoveredEndings,
  onEndingDiscovered,
  totalEndings,
  autoFocus = false,
  className = "",
}: Props) {
  const [state, setState] = useState(() => ({
    ink,
    passage: startStory(ink, startFrom, playOptions),
  }));

  // A new compiled story (edited JSON, Ctrl+Z, edited .ink text): resume at the same scene.
  if (state.ink !== ink) {
    setState({ ink, passage: startStory(ink, state.passage.sceneId ?? startFrom, playOptions) });
  }

  const passage = state.passage;
  const actions = useRef<HTMLDivElement>(null);
  // Focus only follows the reader's own actions, never a recompilation (that would steal
  // the focus from the text editor on the import screen).
  const focusNext = useRef(autoFocus);

  const show = (next: Passage) => {
    focusNext.current = true;
    setState({ ink, passage: next });
    onScene?.(next.sceneId);
  };
  const pick = (index: number) => show(choose(ink, index, playOptions));
  const replay = () => show(startStory(ink, null, playOptions));

  // Latest `pick` for the keyboard listener (avoids re-subscribing on every render).
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });

  // Record the ending as discovered (for « Fins découvertes »).
  const endingKey = passage.endingKey;
  useEffect(() => {
    if (endingKey) onEndingDiscovered(endingKey);
  }, [endingKey, onEndingDiscovered]);

  // Keyboard flow: after each step, focus the first choice (or « Rejouer » at the end).
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    actions.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [passage]);

  // Number keys 1-9 pick a choice (ignored while typing in a field).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      const n = Number(event.key);
      const choice = passage.choices[n - 1];
      if (Number.isInteger(n) && choice) {
        event.preventDefault();
        pickRef.current(choice.index);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [passage]);

  const title = storyTitle(ink);
  // Count the ending on screen right away (the session list is updated just after render).
  const endingsFound = new Set([...discoveredEndings, ...(endingKey ? [endingKey] : [])]).size;
  const mood = passage.ending ? `ending-${passage.ending.kind.toLowerCase()}` : passage.mood;

  return (
    <div className={`reader reader-mood-${mood} ${className}`}>
      <article className="reader-card">
        {title && <p className="reader-story-title">{title}</p>}

        <div aria-live="polite">
          {passage.transition.length > 0 && (
            <div className="reader-transition">
              {passage.transition.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
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
              ) : passage.endingKey ? (
                <p className="reader-ending ending-a">Fin de l'histoire</p>
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

        {onEditScene && (
          <button
            type="button"
            className="button-link reader-edit"
            onClick={() => onEditScene(passage.sceneId)}
          >
            ✏️ Modifier cette scène
          </button>
        )}
      </article>
    </div>
  );
}

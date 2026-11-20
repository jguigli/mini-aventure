// Read mode: a clean, full-screen player for the REAL compiled inkjs story.
// The story is serialized and compiled from the current JSON, then played by InkPlayer,
// which never reads the JSON: if it plays here, the exported .ink works.
import { useMemo } from "react";
import type { Story } from "@shared/schema";
import { InkPlayer } from "../components/InkPlayer";
import { compileInk } from "../lib/inkCompile";
import { storyToInk } from "../lib/inkSerializer";

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
  onEndingDiscovered: (key: string) => void;
  totalEndings: number;
}

export function Reader({ story, onEditScene, ...player }: Props) {
  // Recompiled when the story changes (e.g. Ctrl+Z while reading); InkPlayer resumes in place.
  const compiled = useMemo(() => compileInk(storyToInk(story)), [story]);

  if (!compiled.story) {
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

  return (
    <main className="reader-main">
      <InkPlayer ink={compiled.story} onEditScene={onEditScene} autoFocus {...player} />
    </main>
  );
}

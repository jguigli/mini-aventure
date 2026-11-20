// Loading state while the LLM writes the story (10 to 20 s): a small animation and
// messages that change, so the wait feels alive. Messages are announced politely.
import { useEffect, useState } from "react";

const MESSAGES = [
  "L'IA imagine ton univers…",
  "Elle prépare deux fins bien différentes…",
  "Les scènes prennent forme…",
  "Les choix se branchent entre eux…",
  "Le code vérifie que chaque fin est atteignable…",
  "Encore quelques secondes…",
];
const MESSAGE_INTERVAL_MS = 3000;

export function GeneratingStory({ onCancel }: { onCancel: () => void }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => Math.min(i + 1, MESSAGES.length - 1)),
      MESSAGE_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="generating">
      <div className="generating-art" aria-hidden="true">
        <span>📖</span>
        <span>✨</span>
        <span>🧭</span>
      </div>
      <p className="generating-message" role="status" aria-live="polite">
        {MESSAGES[index]}
      </p>
      <button type="button" className="button-link" onClick={onCancel}>
        Annuler
      </button>
    </div>
  );
}

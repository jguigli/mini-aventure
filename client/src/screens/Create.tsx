// Creation screen: idea + reading level → generated story.
// Also offers to resume the autosaved story, and to load the built-in example (no API call).
import { useRef, useState, type FormEvent } from "react";
import { MAX_IDEA_LENGTH } from "@shared/api";
import { Story, type ReadingLevel } from "@shared/schema";
import examplePhare from "../../../examples/le-phare.json";
// Public example from inkle's documentation (MIT), loaded as text by Vite.
import exampleFogg from "../../../examples/monsieur-fogg.ink?raw";
import { GeneratingStory } from "../components/GeneratingStory";
import { ReadingLevelPicker } from "../components/ReadingLevelPicker";
import { ApiClientError, requestStory } from "../lib/api";
import type { SavedStory } from "../state/autosave";
import type { ImportedInk } from "./ImportScreen";

/** Imported files above this size are refused (a story is a few KB). */
const MAX_IMPORT_BYTES = 1_000_000;

const IDEA_PLACEHOLDER =
  "Ex. : Une gardienne de phare entend une voix monter de la mer… ou : un robot jardinier trouve une graine qui parle.";

interface Props {
  saved: SavedStory | null;
  onResume: () => void;
  onDiscardSaved: () => void;
  /** `warnings`: issues the AI left after its retry (0 for the example or a valid story). */
  onStory: (story: Story, warnings?: number) => void;
  /** null while unknown, false when the server reports no OpenAI key. */
  hasApiKey: boolean | null;
  /** Opens an .ink file in text mode. */
  onImport: (file: ImportedInk) => void;
}

type Phase = { kind: "idle" } | { kind: "generating" } | { kind: "error"; message: string };

export function Create({ saved, onResume, onDiscardSaved, onStory, hasApiKey, onImport }: Props) {
  const [idea, setIdea] = useState("");
  const [level, setLevel] = useState<ReadingLevel>("11-12");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);

  const generating = phase.kind === "generating";
  const canGenerate = idea.trim().length > 0 && !generating;

  const generate = async () => {
    if (!idea.trim()) return;
    abort.current = new AbortController();
    setPhase({ kind: "generating" });
    try {
      const { story, warnings } = await requestStory(
        { idea: idea.trim(), readingLevel: level },
        abort.current.signal,
      );
      onStory(story, warnings.length);
    } catch (error) {
      if (abort.current?.signal.aborted) {
        setPhase({ kind: "idle" }); // cancelled by the author
        return;
      }
      const message =
        error instanceof ApiClientError ? error.message : "Une erreur inattendue est survenue.";
      setPhase({ kind: "error", message });
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void generate();
  };

  const loadExample = () => onStory(Story.parse(examplePhare));
  const fileInput = useRef<HTMLInputElement>(null);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setPhase({
        kind: "error",
        message: "Ce fichier est trop gros pour une mini-aventure (1 Mo au plus).",
      });
      return;
    }
    const source = await file.text();
    if (!source.trim()) {
      setPhase({ kind: "error", message: "Ce fichier est vide." });
      return;
    }
    onImport({ source, fileName: file.name });
  };

  return (
    <main className="page">
      <section className="card create-card">
        <header className="create-header">
          <p className="logo" aria-hidden="true">
            🧭
          </p>
          <h1>Mini-aventure</h1>
          <p className="subtitle">
            Imagine une histoire à choix pour les 8-15 ans. L'IA écrit, tu décides.
          </p>
        </header>

        {saved && !generating && (
          <div className="resume-banner" role="region" aria-label="Sauvegarde trouvée">
            <p>
              Reprendre ton aventure : <strong>{saved.story.title}</strong>
            </p>
            <div className="resume-actions">
              <button type="button" className="button-primary" onClick={onResume}>
                Reprendre
              </button>
              <button type="button" className="button-secondary" onClick={onDiscardSaved}>
                Nouvelle histoire
              </button>
            </div>
          </div>
        )}

        {hasApiKey === false && (
          <p className="notice notice-warn">
            Clé OpenAI manquante : renseigne <code>server/.env</code> pour générer une histoire. Tu
            peux déjà charger l'exemple.
          </p>
        )}

        {generating ? (
          <GeneratingStory onCancel={() => abort.current?.abort()} />
        ) : (
          <form className="create-form" onSubmit={onSubmit}>
            <label htmlFor="idea" className="field-label">
              Ton idée
            </label>
            <textarea
              id="idea"
              className="idea-input"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              placeholder={IDEA_PLACEHOLDER}
              maxLength={MAX_IDEA_LENGTH}
              rows={4}
              aria-describedby="idea-count"
            />
            <p id="idea-count" className="field-hint">
              {idea.length}/{MAX_IDEA_LENGTH} caractères
            </p>

            <p id="level-label" className="field-label">
              Niveau de lecture
            </p>
            <ReadingLevelPicker value={level} onChange={setLevel} />

            {phase.kind === "error" && (
              <div className="notice notice-error" role="alert">
                <p>{phase.message}</p>
                <button type="button" className="button-secondary" onClick={() => void generate()}>
                  Réessayer
                </button>
              </div>
            )}

            <button type="submit" className="button-primary button-large" disabled={!canGenerate}>
              ✨ Générer l'aventure
            </button>

            <div className="create-links">
              <button type="button" className="button-link" onClick={loadExample}>
                Charger l'exemple
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className="button-link"
                onClick={() => fileInput.current?.click()}
              >
                Importer un .ink
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".ink,text/plain"
                hidden
                onChange={(event) => {
                  void importFile(event.target.files?.[0]);
                  event.target.value = ""; // allow re-importing the same file
                }}
              />
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className="button-link"
                onClick={() => onImport({ source: exampleFogg, fileName: "monsieur-fogg.ink" })}
              >
                Exemple Ink d'inkle
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

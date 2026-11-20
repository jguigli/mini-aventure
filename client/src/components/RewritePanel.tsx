// « ✨ Retravailler avec l'IA » for the selected scene.
// The AI only PROPOSES: the author sees a before/after preview and keeps a version (one undo
// step, so Ctrl+Z restores the previous text) or cancels. Choice targets never change: the
// server checks the structure, and applySceneRewrite keeps the original ids and targets.
import { useEffect, useRef, useState } from "react";
import { MAX_INSTRUCTION_LENGTH } from "@shared/api";
import type { Scene, SceneRewrite, Story } from "@shared/schema";
import { ApiClientError, requestRewrite } from "../lib/api";
import { applySceneRewrite } from "../lib/storyEdits";
import { storyStore } from "../state/storyStore";

/** Quick actions: a label for the button, and the instruction actually sent to the AI. */
const QUICK_ACTIONS = [
  {
    label: "Améliorer le style",
    instruction:
      "Améliore le style : des phrases plus vivantes et plus imagées, sans changer ce qui se passe.",
  },
  {
    label: "Plus court",
    instruction:
      "Rends la scène plus courte : va à l'essentiel en gardant les informations importantes.",
  },
  {
    label: "Plus de suspense",
    instruction: "Ajoute du suspense, sans rien d'effrayant pour l'âge du lecteur.",
  },
  {
    label: "Adapter au niveau de lecture",
    instruction:
      "Adapte le vocabulaire, la longueur des phrases et le ton au niveau de lecture de l'histoire.",
  },
];

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "preview"; variants: SceneRewrite[] }
  | { kind: "error"; message: string };

function SceneSummary({
  title,
  emoji,
  text,
  choices,
  ending,
}: {
  title: string;
  emoji: string;
  text: string;
  choices: { id: string; label: string; emoji: string }[];
  ending: string | null;
}) {
  return (
    <>
      <p className="rewrite-title">
        <span aria-hidden="true">{emoji}</span> {title}
      </p>
      <p className="rewrite-text">{text}</p>
      {choices.length > 0 && (
        <ul className="rewrite-choices">
          {choices.map((c) => (
            <li key={c.id}>
              <span aria-hidden="true">{c.emoji}</span> {c.label}
            </li>
          ))}
        </ul>
      )}
      {ending && <p className="rewrite-ending">Fin : {ending}</p>}
    </>
  );
}

export function RewritePanel({ story, scene }: { story: Story; scene: Scene }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [instruction, setInstruction] = useState("");
  const [threeVariants, setThreeVariants] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const lastInstruction = useRef("");

  useEffect(() => () => abort.current?.abort(), []); // leaving the scene cancels the request

  const run = async (text: string) => {
    lastInstruction.current = text;
    abort.current = new AbortController();
    setPhase({ kind: "loading" });
    try {
      const variants = await requestRewrite(
        { story, sceneId: scene.id, instruction: text, variants: threeVariants ? 3 : 1 },
        abort.current.signal,
      );
      setPhase({ kind: "preview", variants });
    } catch (error) {
      if (abort.current?.signal.aborted) return;
      setPhase({
        kind: "error",
        message:
          error instanceof ApiClientError ? error.message : "Une erreur inattendue est survenue.",
      });
    }
  };

  const keep = (variant: SceneRewrite) => {
    // One discrete edit = one undo step: Ctrl+Z brings the previous version back.
    storyStore.edit((s) => applySceneRewrite(s, scene.id, variant));
    setPhase({ kind: "idle" });
  };

  if (scene.locked) {
    return (
      <section className="rewrite-panel" aria-label="Retravailler avec l'IA">
        <h3>✨ Retravailler avec l'IA</h3>
        <p className="muted">
          🔒 Scène verrouillée : l'IA n'y touche pas. Déverrouille-la pour la retravailler.
        </p>
      </section>
    );
  }

  return (
    <section className="rewrite-panel" aria-label="Retravailler avec l'IA">
      <h3>✨ Retravailler avec l'IA</h3>

      {phase.kind === "preview" ? (
        <div className="rewrite-preview" aria-live="polite">
          <div className="rewrite-card is-before">
            <p className="rewrite-label">Avant</p>
            <SceneSummary
              title={scene.title}
              emoji={scene.emoji}
              text={scene.text}
              choices={scene.choices}
              ending={scene.ending?.label ?? null}
            />
          </div>
          {phase.variants.map((variant, i) => (
            <div key={i} className="rewrite-card is-after">
              <p className="rewrite-label">
                {phase.variants.length > 1 ? `Proposition ${i + 1}` : "Après"}
              </p>
              <SceneSummary
                title={variant.title}
                emoji={variant.emoji}
                text={variant.text}
                choices={variant.choices}
                ending={variant.endingLabel}
              />
              <button type="button" className="button-primary" onClick={() => keep(variant)}>
                {phase.variants.length > 1 ? "Garder celle-ci" : "Garder"}
              </button>
            </div>
          ))}
          <div className="rewrite-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setPhase({ kind: "idle" })}
            >
              Annuler
            </button>
            <button
              type="button"
              className="button-link"
              onClick={() => void run(lastInstruction.current)}
            >
              Autre proposition
            </button>
          </div>
        </div>
      ) : phase.kind === "loading" ? (
        <div className="rewrite-loading" role="status">
          <span aria-hidden="true">✨</span> L'IA réécrit la scène…{" "}
          <button
            type="button"
            className="button-link"
            onClick={() => {
              abort.current?.abort();
              setPhase({ kind: "idle" });
            }}
          >
            Annuler
          </button>
        </div>
      ) : (
        <>
          <div className="quick-actions">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                className="button-secondary button-small"
                onClick={() => void run(action.instruction)}
              >
                {action.label}
              </button>
            ))}
          </div>
          <form
            className="rewrite-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (instruction.trim()) void run(instruction.trim());
            }}
          >
            <label className="field">
              <span>Ou ta consigne</span>
              <input
                value={instruction}
                maxLength={MAX_INSTRUCTION_LENGTH}
                placeholder="Ex. : Fais parler le chat"
                onChange={(event) => setInstruction(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="button-primary button-small"
              disabled={!instruction.trim()}
            >
              Proposer
            </button>
          </form>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={threeVariants}
              onChange={(e) => setThreeVariants(e.target.checked)}
            />
            Proposer 3 variantes
          </label>
          {phase.kind === "error" && (
            <p className="notice notice-error" role="alert">
              {phase.message}
            </p>
          )}
        </>
      )}
    </section>
  );
}

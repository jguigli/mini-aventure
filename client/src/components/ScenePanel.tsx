// Side panel for the selected scene: every field of the scene and its choices.
// Every change goes through storyStore.edit, so it is undoable. Text fields pass a
// coalesceKey, so typing a sentence is ONE undo step; discrete actions are one step each.
import { useEffect, useRef } from "react";
import type { Scene, Story } from "@shared/schema";
import { Mood } from "@shared/schema";
import type { ValidationIssue } from "@shared/validate";
import {
  addChoice,
  addScene,
  removeChoice,
  removeScene,
  sceneRemovalBlocker,
  setLocked,
  updateChoice,
  updateEndingLabel,
  updateScene,
} from "../lib/storyEdits";
import { storyStore } from "../state/storyStore";
import { RewritePanel } from "./RewritePanel";

const MOOD_LABELS: Record<Mood, string> = {
  calme: "Calme",
  mystere: "Mystère",
  tension: "Tension",
  joie: "Joie",
  sombre: "Sombre",
};

interface Props {
  story: Story;
  scene: Scene;
  issues: ValidationIssue[];
  onSelect: (sceneId: string | null) => void;
  /** « ▶ Jouer depuis ici »: opens Lecture at this scene. */
  onPlayFrom: (sceneId: string) => void;
}

export function ScenePanel({ story, scene, issues, onSelect, onPlayFrom }: Props) {
  const edit = storyStore.edit;
  const key = (field: string) => `scene:${scene.id}:${field}`;
  const isStart = scene.id === story.startSceneId;
  const removalBlocker = sceneRemovalBlocker(story, scene.id);
  // Opening a scene (map, scene list, report link) moves the focus to its panel heading,
  // so keyboard and screen-reader users land where the editing happens.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const sceneIds = new Set(story.scenes.map((s) => s.id));

  const onDelete = () => {
    const incoming = story.scenes.filter((s) =>
      s.choices.some((c) => c.targetSceneId === scene.id),
    );
    const warning =
      incoming.length > 0
        ? `\n\n${incoming.length} scène(s) y mènent : leurs choix resteront, signalés « destination manquante ».`
        : "";
    if (window.confirm(`Supprimer la scène « ${scene.title} » ?${warning}`)) {
      edit((s) => removeScene(s, scene.id));
      onSelect(null);
    }
  };

  return (
    <div className="scene-panel">
      <div className="panel-heading">
        <h2 ref={heading} tabIndex={-1}>
          <span aria-hidden="true">{scene.emoji}</span>{" "}
          {scene.ending ? `Fin ${scene.ending.kind}` : "Scène"}
          {isStart && <span className="tag">Départ</span>}
        </h2>
        <div className="panel-heading-actions">
          <button
            type="button"
            className={`button-secondary button-small lock-toggle${scene.locked ? " is-locked" : ""}`}
            aria-pressed={scene.locked === true}
            title="Une scène verrouillée n'est jamais modifiée par l'IA"
            onClick={() => edit((s) => setLocked(s, scene.id, !scene.locked))}
          >
            {scene.locked ? "🔒 Verrouillée" : "🔓 Verrouiller"}
          </button>
          <button type="button" className="button-link" onClick={() => onSelect(null)}>
            Fermer
          </button>
        </div>
      </div>

      {issues.length > 0 && (
        <ul className="issue-list" aria-label="Problèmes de cette scène">
          {issues.map((issue, i) => (
            <li key={i}>⚠️ {issue.message}</li>
          ))}
        </ul>
      )}

      <RewritePanel story={story} scene={scene} />

      <div className="field-row">
        <label className="field">
          <span>Titre</span>
          <input
            value={scene.title}
            onChange={(e) =>
              edit((s) => updateScene(s, scene.id, { title: e.target.value }), {
                coalesceKey: key("title"),
              })
            }
          />
        </label>
        <label className="field field-emoji">
          <span>Emoji</span>
          <input
            value={scene.emoji}
            onChange={(e) =>
              edit((s) => updateScene(s, scene.id, { emoji: e.target.value }), {
                coalesceKey: key("emoji"),
              })
            }
          />
        </label>
      </div>

      <label className="field">
        <span>Ambiance</span>
        <select
          value={scene.mood}
          onChange={(e) => edit((s) => updateScene(s, scene.id, { mood: e.target.value as Mood }))}
        >
          {Mood.options.map((mood) => (
            <option key={mood} value={mood}>
              {MOOD_LABELS[mood]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Texte</span>
        <textarea
          className="autosize"
          value={scene.text}
          rows={4}
          onChange={(e) =>
            edit((s) => updateScene(s, scene.id, { text: e.target.value }), {
              coalesceKey: key("text"),
            })
          }
        />
      </label>

      {scene.ending ? (
        <label className="field">
          <span>Libellé de la fin {scene.ending.kind}</span>
          <input
            value={scene.ending.label}
            onChange={(e) =>
              edit((s) => updateEndingLabel(s, scene.id, e.target.value), {
                coalesceKey: key("ending"),
              })
            }
          />
        </label>
      ) : (
        <fieldset className="choices">
          <legend>Choix</legend>
          {scene.choices.map((choice) => {
            const ckey = (field: string) => `choice:${scene.id}:${choice.id}:${field}`;
            const targetExists = sceneIds.has(choice.targetSceneId);
            return (
              <div key={choice.id} className={`choice-editor${targetExists ? "" : " is-broken"}`}>
                <div className="field-row">
                  <label className="field field-emoji">
                    <span>Emoji</span>
                    <input
                      value={choice.emoji}
                      onChange={(e) =>
                        edit(
                          (s) => updateChoice(s, scene.id, choice.id, { emoji: e.target.value }),
                          {
                            coalesceKey: ckey("emoji"),
                          },
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Libellé</span>
                    <input
                      value={choice.label}
                      onChange={(e) =>
                        edit(
                          (s) => updateChoice(s, scene.id, choice.id, { label: e.target.value }),
                          {
                            coalesceKey: ckey("label"),
                          },
                        )
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Ce qui se passe ensuite (lu juste après le choix)</span>
                  <input
                    value={choice.outcome ?? ""}
                    placeholder="Ex. : Milo propose un jeu, et les mésanges l'entraînent."
                    onChange={(e) =>
                      edit(
                        (s) => updateChoice(s, scene.id, choice.id, { outcome: e.target.value }),
                        {
                          coalesceKey: ckey("outcome"),
                        },
                      )
                    }
                  />
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>Mène à</span>
                    <select
                      value={choice.targetSceneId}
                      onChange={(e) =>
                        edit((s) =>
                          updateChoice(s, scene.id, choice.id, { targetSceneId: e.target.value }),
                        )
                      }
                    >
                      <option value="">— Choisir une destination —</option>
                      {!targetExists && choice.targetSceneId && (
                        <option value={choice.targetSceneId}>
                          ⚠️ « {choice.targetSceneId} » (introuvable)
                        </option>
                      )}
                      {story.scenes
                        .filter((s) => s.id !== scene.id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.emoji} {s.title}
                            {s.ending ? ` (fin ${s.ending.kind})` : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="button-icon"
                    onClick={() => edit((s) => removeChoice(s, scene.id, choice.id))}
                    aria-label={`Supprimer le choix « ${choice.label} »`}
                    title="Supprimer ce choix"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="button-secondary"
            onClick={() => edit((s) => addChoice(s, scene.id).story)}
          >
            + Ajouter un choix
          </button>
        </fieldset>
      )}

      <div className="panel-actions">
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            const { story: next, sceneId } = addScene(storyStore.getState().present!);
            edit(() => next);
            onSelect(sceneId);
          }}
        >
          + Nouvelle scène
        </button>
        <button type="button" className="button-secondary" onClick={() => onPlayFrom(scene.id)}>
          ▶ Jouer depuis ici
        </button>
        <button
          type="button"
          className="button-danger"
          onClick={onDelete}
          disabled={removalBlocker !== null}
          title={removalBlocker ?? undefined}
        >
          Supprimer la scène
        </button>
      </div>
    </div>
  );
}

// Keyboard and screen-reader alternative to the map: every scene as a button, with its
// status spelled out (start, ending, unreachable, problems). Shown in the side panel when
// no scene is selected. Opening a scene moves the focus to its panel (see ScenePanel).
import type { Story } from "@shared/schema";
import type { StoryAnalysis } from "../lib/analysis";

interface Props {
  story: Story;
  analysis: StoryAnalysis;
  onSelect: (sceneId: string) => void;
}

export function SceneList({ story, analysis, onSelect }: Props) {
  return (
    <nav className="scene-list-nav" aria-labelledby="scene-list-title">
      <h2 id="scene-list-title" className="scene-list-title">
        Scènes ({story.scenes.length})
      </h2>
      <ul className="scene-list">
        {story.scenes.map((scene) => {
          const status = [
            scene.id === story.startSceneId && "départ",
            scene.ending && `fin ${scene.ending.kind}`,
            scene.locked && "verrouillée",
            analysis.unreachable.has(scene.id) && "inaccessible",
            !scene.ending && scene.choices.length === 0 && "impasse",
            analysis.issuesByScene.has(scene.id) &&
              `${analysis.issuesByScene.get(scene.id)!.length} problème(s)`,
          ].filter(Boolean) as string[];
          return (
            <li key={scene.id}>
              <button type="button" className="scene-list-item" onClick={() => onSelect(scene.id)}>
                <span aria-hidden="true">{scene.emoji}</span>
                <span className="scene-list-name">{scene.title || "Sans titre"}</span>
                {status.length > 0 && (
                  <span className="scene-list-status">{status.join(" · ")}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

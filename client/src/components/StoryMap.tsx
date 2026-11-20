// The story map: one node per scene, one arrow per choice (React Flow).
// Positions come from computeLayout (columns by depth); nodes are not draggable.
// Colours carry meaning: mood for narrative scenes, two distinct colours for endings A and B,
// greyed and dashed for unreachable scenes, ⚠️ for dead ends and other issues.
import { memo, useEffect, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Story } from "@shared/schema";
import type { StoryAnalysis } from "../lib/analysis";
import { computeLayout } from "../lib/layout";

type SceneNodeData = {
  emoji: string;
  title: string;
  mood: string;
  ending: "A" | "B" | null;
  isStart: boolean;
  locked: boolean;
  unreachable: boolean;
  /** A real dead end: a narrative scene with no choices at all. */
  deadEnd: boolean;
  issueCount: number;
  /** Quick test: the scene the tester is on, and scenes already visited. */
  current: boolean;
  visited: boolean;
};
type SceneNodeType = Node<SceneNodeData, "scene">;

const SceneNode = memo(function SceneNode({ data, selected }: NodeProps<SceneNodeType>) {
  const classes = [
    "scene-node",
    data.ending ? `ending-${data.ending.toLowerCase()}` : `mood-bg-${data.mood}`,
    data.unreachable && "is-unreachable",
    data.current && "is-current",
    data.visited && "is-visited",
    selected && "is-selected",
  ]
    .filter(Boolean)
    .join(" ");
  const warning = data.deadEnd || data.issueCount > 0;
  return (
    <div className={classes}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <span className="scene-node-emoji" aria-hidden="true">
        {data.emoji}
      </span>
      <span className="scene-node-title">{data.title || "Sans titre"}</span>
      <span className="scene-node-tags">
        {data.isStart && <span className="tag">Départ</span>}
        {data.locked && (
          <span className="tag" title="Verrouillée : l'IA n'y touche pas">
            🔒
          </span>
        )}
        {data.ending && <span className="tag">Fin {data.ending}</span>}
        {data.unreachable && <span className="tag tag-muted">Inaccessible</span>}
        {warning && (
          <span
            className="tag tag-warn"
            title={data.deadEnd ? "Impasse : ni choix ni fin" : `${data.issueCount} problème(s)`}
          >
            ⚠️ {data.deadEnd ? "Impasse" : data.issueCount}
          </span>
        )}
      </span>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
});

const nodeTypes = { scene: SceneNode };

interface Props {
  story: Story;
  analysis: StoryAnalysis;
  selectedId: string | null;
  onSelect: (sceneId: string | null) => void;
  /** Quick test path: scene ids in order, and the edges ("scene:choice") taken. */
  testPath: string[];
  testEdges: Set<string>;
}

export function StoryMap({ story, analysis, selectedId, onSelect, testPath, testEdges }: Props) {
  const layout = useMemo(() => computeLayout(story), [story]);

  // Re-frame the map when its STRUCTURE changes (a scene added, removed or moved to another
  // column), not on every keystroke: otherwise a scene can end up outside the visible area.
  const flow = useRef<ReactFlowInstance<SceneNodeType, Edge> | null>(null);
  const structureKey = [...layout.columns].map(([id, column]) => `${id}:${column}`).join("|");
  useEffect(() => {
    void flow.current?.fitView({ padding: 0.2, duration: 300 });
  }, [structureKey]);

  const nodes = useMemo<SceneNodeType[]>(() => {
    const { positions } = layout;
    const current = testPath.at(-1);
    return story.scenes.map((scene) => ({
      id: scene.id,
      type: "scene",
      position: positions.get(scene.id) ?? { x: 0, y: 0 },
      selected: scene.id === selectedId,
      data: {
        emoji: scene.emoji,
        title: scene.title,
        mood: scene.mood,
        ending: scene.ending?.kind ?? null,
        isStart: scene.id === story.startSceneId,
        locked: scene.locked === true,
        unreachable: analysis.unreachable.has(scene.id),
        deadEnd: !scene.ending && scene.choices.length === 0,
        issueCount: analysis.issuesByScene.get(scene.id)?.length ?? 0,
        current: scene.id === current,
        visited: testPath.includes(scene.id),
      },
    }));
  }, [story, layout, analysis, selectedId, testPath]);

  const edges = useMemo<Edge[]>(() => {
    const ids = new Set(story.scenes.map((s) => s.id));
    return story.scenes.flatMap((scene) =>
      scene.choices
        .filter((choice) => ids.has(choice.targetSceneId)) // missing targets: no arrow, a ⚠️ instead
        .map((choice) => {
          const id = `${scene.id}:${choice.id}`;
          const taken = testEdges.has(id);
          return {
            id,
            source: scene.id,
            target: choice.targetSceneId,
            label: choice.emoji,
            className: taken ? "edge-taken" : undefined,
            animated: taken,
            markerEnd: { type: MarkerType.ArrowClosed },
          };
        }),
    );
  }, [story, testEdges]);

  return (
    <div className="story-map" aria-label="Carte de l'histoire">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        onInit={(instance) => {
          flow.current = instance;
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

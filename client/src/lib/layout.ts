// Map layout: one column per depth, computed from the story graph. No layout library:
// for 6 to 10 scenes, columns by breadth-first depth are readable and fully predictable.
//   - column = shortest number of choices from the start scene (breadth-first search);
//   - endings ALWAYS share the last column, ending A above ending B, even when unreachable
//     (they are greyed on the map): the endings stay where the author expects them;
//   - narrative scenes that cannot be reached go to a separate column on the right;
//   - inside a column, scenes keep the order in which the search found them,
//     and the column is centred vertically.
import type { Story } from "@shared/schema";

export const COLUMN_WIDTH = 280;
export const ROW_HEIGHT = 140;

export interface MapLayout {
  positions: Map<string, { x: number; y: number }>;
  /** Column of each scene (0 = start). */
  columns: Map<string, number>;
  /** Index of the column holding unreachable scenes, or null if every scene is reachable. */
  unreachableColumn: number | null;
}

export function computeLayout(story: Story): MapLayout {
  const byId = new Map(story.scenes.map((scene) => [scene.id, scene]));

  // 1. Breadth-first search from the start: depth = shortest path length.
  const depth = new Map<string, number>();
  const order: string[] = []; // discovery order, used to sort scenes inside a column
  if (byId.has(story.startSceneId)) {
    depth.set(story.startSceneId, 0);
    const queue = [story.startSceneId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);
      for (const choice of byId.get(id)!.choices) {
        const target = choice.targetSceneId;
        if (byId.has(target) && !depth.has(target)) {
          depth.set(target, depth.get(id)! + 1);
          queue.push(target);
        }
      }
    }
  }

  // 2. Columns: narrative scenes by depth, then endings, then unreachable scenes.
  const reachableNarrative = story.scenes.filter((s) => depth.has(s.id) && !s.ending);
  const lastNarrativeColumn = Math.max(0, ...reachableNarrative.map((s) => depth.get(s.id)!));
  const endingColumn = lastNarrativeColumn + 1;
  const hasEndings = story.scenes.some((s) => s.ending);
  const unreachable = story.scenes.filter((s) => !depth.has(s.id) && !s.ending);
  const unreachableColumn = unreachable.length > 0 ? endingColumn + (hasEndings ? 1 : 0) : null;

  const columns = new Map<string, number>();
  for (const scene of story.scenes) {
    if (scene.ending) columns.set(scene.id, endingColumn);
    else if (!depth.has(scene.id)) columns.set(scene.id, unreachableColumn!);
    else columns.set(scene.id, depth.get(scene.id)!);
  }

  // 3. Rows: discovery order (endings: A before B; unreachable: story order).
  const rank = (id: string) => {
    const scene = byId.get(id)!;
    if (scene.ending) return scene.ending.kind === "A" ? 0 : 1;
    if (!depth.has(id)) return order.length + story.scenes.indexOf(scene);
    return order.indexOf(id);
  };
  const byColumn = new Map<number, string[]>();
  for (const [id, column] of columns) byColumn.set(column, [...(byColumn.get(column) ?? []), id]);

  const positions = new Map<string, { x: number; y: number }>();
  for (const [column, ids] of byColumn) {
    ids.sort((a, b) => rank(a) - rank(b));
    ids.forEach((id, row) => {
      positions.set(id, {
        x: column * COLUMN_WIDTH,
        y: (row - (ids.length - 1) / 2) * ROW_HEIGHT, // centred around y = 0
      });
    });
  }

  return { positions, columns, unreachableColumn };
}

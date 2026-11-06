export type RoadmapTreeItem = {
  id: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: Date;
};

export function orderRoadmapStages<T extends RoadmapTreeItem>(stages: T[]): T[] {
  const childrenByParent = new Map<string | null, T[]>();
  for (const stage of stages) {
    const siblings = childrenByParent.get(stage.parentId) ?? [];
    siblings.push(stage);
    childrenByParent.set(stage.parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());
  }

  const ordered: T[] = [];
  const visited = new Set<string>();
  function appendBranch(stage: T) {
    if (visited.has(stage.id)) return;
    visited.add(stage.id);
    ordered.push(stage);
    for (const child of childrenByParent.get(stage.id) ?? []) appendBranch(child);
  }
  for (const root of childrenByParent.get(null) ?? []) appendBranch(root);
  for (const stage of stages) appendBranch(stage);
  return ordered;
}

export function roadmapDescendantIds(stages: RoadmapTreeItem[], stageId: string): Set<string> {
  const descendants = new Set<string>();
  const pending = [stageId];
  while (pending.length) {
    const parentId = pending.pop();
    for (const stage of stages) {
      if (stage.parentId !== parentId || descendants.has(stage.id)) continue;
      descendants.add(stage.id);
      pending.push(stage.id);
    }
  }
  return descendants;
}

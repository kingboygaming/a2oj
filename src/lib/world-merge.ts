import type { WorldMapObject } from "./world-map-objects";
import type { WorldMapObjectState, WorldSnapshot } from "./world";
import type { WorldEntityPayload } from "./world-realtime";

/**
 * Pure merge helpers for incremental world updates.
 *
 * Rules:
 * - The server is authoritative, but a payload whose row version is *older*
 *   than what we already hold never overwrites it (out-of-order responses,
 *   duplicate hints, stale polls).
 * - When nothing actually changed the exact same snapshot object is returned so
 *   React (and the 3D scene) can bail out without re-rendering.
 */

function shallowEqual(left: object, right: object) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if ((left as Record<string, unknown>)[key] !== (right as Record<string, unknown>)[key]) {
      return false;
    }
  }
  return true;
}

function mergeBases(
  current: WorldSnapshot["nearbyBases"],
  incoming: WorldSnapshot["nearbyBases"],
) {
  const currentById = new Map(current.map((base) => [base.userId, base]));
  let changed = incoming.length !== current.length;
  const merged = incoming.map((nextBase) => {
    const existing = currentById.get(nextBase.userId);
    if (!existing) return nextBase;
    if (nextBase.version < existing.version) return existing;
    if (shallowEqual(existing, nextBase)) return existing;
    changed = true;
    return nextBase;
  });
  merged.sort((left, right) => left.distanceMeters - right.distanceMeters);
  return { bases: merged, changed };
}

function mergeMapObjectStates(
  currentStates: WorldMapObjectState[],
  currentDefinitions: WorldMapObject[],
  incoming: WorldEntityPayload["mapObjects"],
) {
  let changed = false;
  let definitionsChanged = false;

  const definitionById = new Map(currentDefinitions.map((definition) => [definition.id, definition]));
  for (const entry of incoming) {
    if (!definitionById.has(entry.definition.id)) {
      definitionById.set(entry.definition.id, entry.definition);
      definitionsChanged = true;
      changed = true;
    }
  }

  const incomingStateById = new Map(incoming.map((entry) => [entry.state.id, entry.state]));
  const mergedStates = currentStates.map((currentState) => {
    const nextState = incomingStateById.get(currentState.id);
    if (!nextState) return currentState;
    incomingStateById.delete(currentState.id);
    if (nextState.version < currentState.version) return currentState;
    if (shallowEqual(currentState, nextState)) return currentState;
    changed = true;
    return nextState;
  });
  for (const nextState of incomingStateById.values()) {
    mergedStates.push(nextState);
    changed = true;
  }

  return {
    states: mergedStates,
    definitions: definitionsChanged ? [...definitionById.values()] : currentDefinitions,
    changed,
  };
}

/**
 * Apply an incremental `/api/world/entities` payload.
 *
 * `payload.bases` is always the complete set of bases in view, so bases missing
 * from it are removed. Map objects are partial (only requested ids), so existing
 * ones are kept.
 */
export function mergeWorldEntities(
  snapshot: WorldSnapshot,
  payload: WorldEntityPayload,
): WorldSnapshot {
  const bases = mergeBases(snapshot.nearbyBases, payload.bases);
  const objects = mergeMapObjectStates(
    snapshot.mapObjects,
    snapshot.mapObjectDefinitions,
    payload.mapObjects,
  );
  if (!bases.changed && !objects.changed) return snapshot;
  return {
    ...snapshot,
    // Refresh the server clock alongside real changes; avoiding it on no-op
    // payloads is what keeps idle clients from re-rendering every few seconds.
    now: payload.now,
    nearbyBases: bases.bases,
    mapObjects: objects.states,
    mapObjectDefinitions: objects.definitions,
  };
}

/**
 * Merge a freshly loaded full snapshot (manual refresh / post-action refresh)
 * without letting an older entity row overwrite a newer realtime merge.
 */
export function mergeWorldSnapshot(
  current: WorldSnapshot,
  next: WorldSnapshot,
): WorldSnapshot {
  const bases = mergeBases(current.nearbyBases, next.nearbyBases);
  const definitionById = new Map(next.mapObjectDefinitions.map((definition) => [definition.id, definition]));
  const objects = mergeMapObjectStates(
    current.mapObjects,
    current.mapObjectDefinitions,
    next.mapObjects.flatMap((state) => {
      const definition = definitionById.get(state.id);
      return definition ? [{ definition, state }] : [];
    }),
  );
  return {
    ...next,
    nearbyBases: bases.bases,
    mapObjects: objects.states,
    mapObjectDefinitions: objects.definitions,
  };
}

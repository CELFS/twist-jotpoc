export type DataChange = { entity: string; id: string };
const listeners = new Set<(change: DataChange) => void>();

export function publishDataChange(change: DataChange) {
  for (const listener of listeners) listener(change);
}

export function subscribeToDataChanges(listener: (change: DataChange) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

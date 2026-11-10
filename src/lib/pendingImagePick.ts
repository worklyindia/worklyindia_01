/**
 * Keeps a picked image alive across a component remount.
 *
 * Mobile browsers can unmount/remount the current page when returning from the
 * native photo picker. Component state (the selected File) would be lost and
 * the crop dialog would never show. Storing the selection in a module-level
 * map means a remount can pick it straight back up.
 */

export interface PendingImagePick {
  file: File;
  field: string;
  kind?: string;
  at: number;
}

const store = new Map<string, PendingImagePick>();
const MAX_AGE_MS = 5 * 60 * 1000;

export const setPendingImagePick = (scope: string, pick: Omit<PendingImagePick, "at">) => {
  store.set(scope, { ...pick, at: Date.now() });
};

export const getPendingImagePick = (scope: string): PendingImagePick | null => {
  const pick = store.get(scope);
  if (!pick) return null;
  if (Date.now() - pick.at > MAX_AGE_MS) {
    store.delete(scope);
    return null;
  }
  return pick;
};

export const clearPendingImagePick = (scope: string) => {
  store.delete(scope);
};

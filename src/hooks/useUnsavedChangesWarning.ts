import { confirmDialog } from '@/lib/confirmDialog';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks whether a template has edits that were never saved, warns before the
 * browser tab is closed, and asks for confirmation before an in-app navigation
 * throws those edits away.
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  const dirty = useRef(isDirty);
  dirty.current = isDirty;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  /** Returns true when it is safe to navigate away, false when the owner stayed. */
  const confirmDiscard = useCallback(async () => {
    if (!dirty.current) return true;
    return await confirmDialog(
      'You have changes to this template that have not been saved. Leave without saving?',
    );
  }, []);

  return { confirmDiscard };
}

/** Dirty flag helper: mark dirty on edit, clear on save or fresh load. */
export function useDirtyState() {
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = useCallback(() => setIsDirty(true), []);
  const markClean = useCallback(() => setIsDirty(false), []);
  return { isDirty, markDirty, markClean };
}

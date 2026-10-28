/**
 * Setup completion tracking.
 *
 * While a multi-step setup is INCOMPLETE we keep whatever the browser has
 * stored (draft data + step URLs) so the user can come back and continue.
 *
 * Once the setup is COMPLETE we mark it here, so that if the user presses the
 * browser back button they are not dropped back inside the finished wizard —
 * they get sent to the destination page instead.
 */

export type SetupKind = 'jobseeker' | 'employer' | 'resume' | 'cover';

const flagKey = (kind: SetupKind) => `setup_completed_${kind}`;

export const markSetupComplete = (kind: SetupKind) => {
  try {
    sessionStorage.setItem(flagKey(kind), String(Date.now()));
  } catch {
    /* ignore */
  }
};

export const isSetupComplete = (kind: SetupKind): boolean => {
  try {
    return !!sessionStorage.getItem(flagKey(kind));
  } catch {
    return false;
  }
};

/** Call when the user deliberately re-opens the wizard (edit / start again). */
export const clearSetupComplete = (kind: SetupKind) => {
  try {
    sessionStorage.removeItem(flagKey(kind));
  } catch {
    /* ignore */
  }
};

/** Remove any preserved route so refresh/back never restores the wizard. */
export const clearPreservedSetupRoutes = () => {
  try {
    sessionStorage.removeItem('preservedRoute');
    sessionStorage.removeItem('preservedEmployerRoute');
    sessionStorage.removeItem('appInitRoute');
  } catch {
    /* ignore */
  }
};

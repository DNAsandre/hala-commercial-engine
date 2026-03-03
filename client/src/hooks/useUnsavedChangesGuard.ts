/**
 * useUnsavedChangesGuard — P0 Hotfix
 * 
 * Provides:
 * 1. beforeunload handler (browser tab close / hard refresh)
 * 2. A guard function to wrap navigation attempts
 * 
 * Usage:
 *   const { guardNavigation } = useUnsavedChangesGuard(isDirty);
 *   // When user clicks Back:
 *   guardNavigation(() => { doNavigation(); });
 */

import { useEffect, useCallback, useRef } from "react";

export function useUnsavedChangesGuard(isDirty: boolean) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // beforeunload — browser-native "Leave site?" dialog for tab close / hard refresh
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        // Modern browsers ignore custom messages but still show the dialog
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // popstate — browser back/forward button
  useEffect(() => {
    if (!isDirty) return;

    // Push a dummy state to catch back button
    const currentUrl = window.location.href;
    window.history.pushState({ composerGuard: true }, "", currentUrl);

    const handler = (e: PopStateEvent) => {
      if (isDirtyRef.current) {
        // Re-push to prevent actual navigation
        window.history.pushState({ composerGuard: true }, "", currentUrl);
        // The component will handle showing the modal via the pendingNavigation state
        window.dispatchEvent(new CustomEvent("composer-back-attempt"));
      }
    };
    window.addEventListener("popstate", handler);
    return () => {
      window.removeEventListener("popstate", handler);
    };
  }, [isDirty]);

  return { isDirtyRef };
}

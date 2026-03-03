/**
 * ComposerDirtyContext — Global dirty-state bridge
 *
 * Allows the DocumentComposer to register its dirty state globally,
 * so the DashboardLayout sidebar can check before navigating away.
 *
 * IMPORTANT: Uses refs for isDirty to avoid stale closure issues.
 * The guardedNavigate callback reads isDirtyRef.current at call time,
 * not at creation time, so it always has the latest value.
 */

import { createContext, useContext, useState, useCallback, useRef } from "react";

interface ComposerDirtyState {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  guardedNavigate: (navigateFn: () => void) => void;
  registerSaveHandler: (handler: (() => Promise<boolean>) | null) => void;
  showModal: boolean;
  closeModal: () => void;
  discardAndNavigate: () => void;
  saveAndNavigate: () => Promise<void>;
  isSaving: boolean;
}

const ComposerDirtyContext = createContext<ComposerDirtyState>({
  isDirty: false,
  setDirty: () => {},
  guardedNavigate: (fn) => fn(),
  registerSaveHandler: () => {},
  showModal: false,
  closeModal: () => {},
  discardAndNavigate: () => {},
  saveAndNavigate: async () => {},
  isSaving: false,
});

export function ComposerDirtyProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setIsDirtyState] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Use refs so callbacks always read the latest values
  const isDirtyRef = useRef(false);
  const pendingNavRef = useRef<(() => void) | null>(null);
  const saveHandlerRef = useRef<(() => Promise<boolean>) | null>(null);

  const setDirty = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
    setIsDirtyState(dirty);
  }, []);

  const registerSaveHandler = useCallback((handler: (() => Promise<boolean>) | null) => {
    saveHandlerRef.current = handler;
  }, []);

  // guardedNavigate reads isDirtyRef.current at call time — never stale
  const guardedNavigate = useCallback((navigateFn: () => void) => {
    if (isDirtyRef.current) {
      pendingNavRef.current = navigateFn;
      setShowModal(true);
    } else {
      navigateFn();
    }
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    pendingNavRef.current = null;
  }, []);

  const executePending = useCallback(() => {
    setShowModal(false);
    if (pendingNavRef.current) {
      const nav = pendingNavRef.current;
      pendingNavRef.current = null;
      nav();
    }
  }, []);

  const discardAndNavigate = useCallback(() => {
    isDirtyRef.current = false;
    setIsDirtyState(false);
    setShowModal(false);
    if (pendingNavRef.current) {
      const nav = pendingNavRef.current;
      pendingNavRef.current = null;
      setTimeout(nav, 0);
    }
  }, []);

  const saveAndNavigate = useCallback(async () => {
    if (!saveHandlerRef.current) {
      executePending();
      return;
    }
    setIsSaving(true);
    try {
      const saved = await saveHandlerRef.current();
      setIsSaving(false);
      if (saved) {
        executePending();
      }
      // If save failed, keep modal open
    } catch {
      setIsSaving(false);
    }
  }, [executePending]);

  return (
    <ComposerDirtyContext.Provider value={{
      isDirty, setDirty, guardedNavigate, registerSaveHandler,
      showModal, closeModal, discardAndNavigate, saveAndNavigate,
      isSaving,
    }}>
      {children}
    </ComposerDirtyContext.Provider>
  );
}

export function useComposerDirty() {
  return useContext(ComposerDirtyContext);
}

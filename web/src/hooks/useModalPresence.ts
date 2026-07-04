import { useEffect, useSyncExternalStore } from "react";

/**
 * Tracks whether a blocking modal (e.g. OnboardingModal) is open so
 * lower-priority surfaces like ActivityToast can stay quiet meanwhile
 * (layout conventions, issue #60).
 */
let openModalCount = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isBlockingModalOpen(): boolean {
  return openModalCount > 0;
}

/** Register a blocking modal for as long as `open` is true. */
export function useRegisterBlockingModal(open: boolean) {
  useEffect(() => {
    if (!open) return;
    openModalCount += 1;
    emit();
    return () => {
      openModalCount -= 1;
      emit();
    };
  }, [open]);
}

/** Reactive read — re-renders when a blocking modal opens or closes. */
export function useBlockingModalOpen(): boolean {
  return useSyncExternalStore(subscribe, isBlockingModalOpen);
}

import { useState, useRef, useCallback, useEffect } from "react";

const DEFAULT_DELAY_MS = 6000;

// Client-side "soft delete": scheduleDelete hides the item from the UI
// immediately (callers filter their list with isPending), but the real
// deleteFn doesn't run until the undo window elapses. Undo just clears
// the timer — nothing was ever sent to the server, so there's nothing to
// restore. Leaving the page finalizes any pending deletes immediately
// rather than silently dropping ones the user already confirmed.
export function useUndoableDelete(delayMs = DEFAULT_DELAY_MS) {
  const [pending, setPending] = useState([]);
  const timersRef = useRef({});

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(({ timerId, run }) => {
        clearTimeout(timerId);
        run();
      });
    };
  }, []);

  const scheduleDelete = useCallback((key, label, deleteFn) => {
    if (timersRef.current[key]) {
      clearTimeout(timersRef.current[key].timerId);
    }
    const run = () => {
      setPending((prev) => prev.filter((p) => p.key !== key));
      delete timersRef.current[key];
      deleteFn();
    };
    const timerId = setTimeout(run, delayMs);
    timersRef.current[key] = { timerId, run };
    setPending((prev) => [...prev.filter((p) => p.key !== key), { key, label }]);
  }, [delayMs]);

  const undo = useCallback((key) => {
    const entry = timersRef.current[key];
    if (entry) {
      clearTimeout(entry.timerId);
      delete timersRef.current[key];
    }
    setPending((prev) => prev.filter((p) => p.key !== key));
  }, []);

  const isPending = useCallback((key) => pending.some((p) => p.key === key), [pending]);

  return { pending, scheduleDelete, undo, isPending };
}

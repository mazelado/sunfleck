import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router";

/**
 * Ask before leaving a form with changes that haven't been saved: within the app with a dialog,
 * and when closing or reloading the page with the browser's own question.
 *
 * Returns `allowLeave`, to call before the form itself moves on (after saving or deleting), and
 * the `blocker` for a `LeaveDialog`.
 */
export function useLeaveGuard(isDirty: () => boolean) {
  // Read when leaving, not when rendering: forms don't re-render on every keystroke.
  const isDirtyRef = useRef(isDirty);
  const leaving = useRef(false);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !leaving.current &&
      currentLocation.pathname !== nextLocation.pathname &&
      isDirtyRef.current(),
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!leaving.current && isDirtyRef.current()) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, []);

  const allowLeave = useCallback(() => {
    leaving.current = true;
  }, []);

  return { allowLeave, blocker };
}

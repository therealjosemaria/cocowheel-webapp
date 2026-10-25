"use client";
import { useEffect, useRef, type RefObject } from "react";

/** Keep existing modal appearance while supporting keyboard use and focus return. */
export function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  close: () => void,
  busy = false,
  enabled = true,
) {
  const state = useRef({ close, busy });
  useEffect(() => {
    state.current = { close, busy };
  }, [close, busy]);
  useEffect(() => {
    if (!enabled) return;
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement;
    const buttons = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      );
    (buttons()[0] ?? dialog).focus();
    const keyboard = (event: KeyboardEvent) => {
      // A picker or confirmation can be opened above a dialog. Only the top
      // dialog owns keyboard trapping; the underlying form keeps its draft.
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
      if (dialogs.length && dialogs[dialogs.length - 1] !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!state.current.busy) state.current.close();
      }
      if (event.key !== "Tab") return;
      const targets = buttons();
      const first = targets[0];
      const last = targets.at(-1);
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [ref, enabled]);
}

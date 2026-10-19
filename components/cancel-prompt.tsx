"use client";
import { useRef } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";

export default function CancelPrompt({
  busy,
  request,
  close,
  confirm,
}: {
  busy: boolean;
  request: boolean;
  close: () => void;
  confirm: () => void | Promise<void>;
}) {
  const action = request ? "Withdraw request" : "Cancel ride";
  const dialog = useRef<HTMLElement | null>(null);
  useDialogFocus(dialog, close, busy);
  return (
    <div className="cancel-prompt-backdrop" role="presentation">
      <section
        ref={dialog}
        tabIndex={-1}
        className="cancel-prompt"
        role="dialog"
        aria-modal="true"
        aria-label={action}
      >
        <div className="cancel-prompt-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={close}
          >
            KEEP IT
          </button>
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={confirm}
          >
            {busy ? "CANCELLING…" : action.toUpperCase()}
          </button>
        </div>
      </section>
    </div>
  );
}

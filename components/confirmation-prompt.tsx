"use client";
import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "@/lib/use-dialog-focus";

export default function ConfirmationPrompt({
  label,
  children,
  busy,
  close,
  confirm,
  action,
  destructive = false,
  cancelLabel = "Go back",
}: {
  label: string;
  children: ReactNode;
  busy: boolean;
  close: () => void;
  confirm: () => void;
  action: string;
  destructive?: boolean;
  cancelLabel?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, close, busy);
  return createPortal(
    <div className="cancel-prompt-backdrop">
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="cancel-prompt demand-prompt"
      >
        <p>{label}</p>
        {children}
        <div className="cancel-prompt-actions">
          {destructive && <button className="secondary" disabled={busy} onClick={close}>Go back</button>}
          <button className={destructive ? "danger" : "primary"} disabled={busy} onClick={confirm}>
            {busy ? "Saving…" : action}
          </button>
          {!destructive && <button className="secondary" disabled={busy} onClick={close}>{cancelLabel}</button>}
        </div>
      </section>
    </div>,
    document.body,
  );
}

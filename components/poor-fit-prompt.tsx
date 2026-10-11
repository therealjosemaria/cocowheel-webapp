"use client";

export default function PoorFitPrompt({
  close,
  confirm,
}: {
  close: () => void;
  confirm: () => void;
}) {
  return (
    <div className="cancel-prompt-backdrop" role="presentation">
      <section
        className="cancel-prompt"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm request"
        aria-describedby="poor-fit-message"
      >
        <p id="poor-fit-message">
          This route is a poor fit. Continue with your request?
        </p>
        <div className="cancel-prompt-actions">
          <button type="button" className="primary" onClick={confirm}>
            CONTINUE
          </button>
          <button type="button" className="secondary" onClick={close}>
            GO BACK
          </button>
        </div>
      </section>
    </div>
  );
}

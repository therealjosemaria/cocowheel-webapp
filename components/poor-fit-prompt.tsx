"use client";

export default function PoorFitPrompt({
  close,
  confirm,
}: {
  close: () => void;
  confirm: () => void;
}) {
  return (
    <div className="location-prompt-backdrop" role="presentation">
      <section
        className="location-prompt"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm request"
        aria-describedby="poor-fit-message"
      >
        <p id="poor-fit-message">
          This route is a poor fit. Continue with your request?
        </p>
        <div className="location-prompt-actions">
          <button type="button" className="secondary" onClick={close}>
            CANCEL
          </button>
          <button type="button" onClick={confirm}>
            CONTINUE
          </button>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function CopyPayId({ value }: { value: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function copy() {
    let text = "PayID copied.";
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      text = "Couldn’t copy. Select the PayID to copy manually.";
    }
    if (!mounted.current) return;
    setMessage(text);
  }
  return (
    <>
      <span className="payid-copy-row">
        <code>{value}</code>
        <button
          type="button"
          className="secondary"
          aria-label="Copy PayID"
          onClick={() => void copy()}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="8" y="8" width="12" height="13" rx="2" />
            <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
          </svg>
          COPY
        </button>
      </span>
      {message
        ? createPortal(
            <div className="cancel-prompt-backdrop" role="presentation">
              <section
                className="cancel-prompt"
                role="dialog"
                aria-modal="true"
                aria-label="Copy PayID confirmation"
              >
                <p>{message}</p>
                <div className="cancel-prompt-actions">
                  <button
                    type="button"
                    className="primary"
                    autoFocus
                    onClick={() => {
                      setMessage(null);
                    }}
                  >
                    OKAY
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

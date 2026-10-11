"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function CopyPayId({ value }: { value: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
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
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), 2500);
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
            <div className="copy-feedback" role="status" aria-live="polite">
              <span>{message}</span>
              <button
                type="button"
                aria-label="Dismiss copy confirmation"
                onClick={() => {
                  clearTimeout(timer.current);
                  setMessage(null);
                }}
              >
                ×
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { departureDuration, plannedDepartureDateTime } from "@/lib/departure-label";

const choices = Array.from({ length: 48 }, (_, index) => (index + 1) * 30);
const rowHeight = 44;

function DepartureWheel({ value, close, confirm }: {
  value: number; close: () => void; confirm: (minutes: number) => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const wheel = useRef<HTMLDivElement>(null);
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [now] = useState(Date.now);
  useDialogFocus(dialog, close);
  useEffect(() => {
    if (wheel.current) wheel.current.scrollTop = (value / 30 - 1) * rowHeight;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [value]);
  const select = (minutes: number) => {
    const next = Math.max(30, Math.min(1440, minutes));
    setDraft(next);
    wheel.current?.scrollTo({ top: (next / 30 - 1) * rowHeight, behavior: "instant" });
  };
  return createPortal(
    <div className="location-prompt-backdrop departure-picker-backdrop">
      <section ref={dialog} tabIndex={-1} className="location-prompt departure-picker"
        role="dialog" aria-modal="true" aria-label="Leaving">
        <div ref={wheel} className="departure-wheel" role="listbox" tabIndex={0}
          aria-label="Departure delay" aria-activedescendant={`${id}-${draft}`}
          onScroll={(event) => setDraft(choices[Math.max(0, Math.min(47,
            Math.round(event.currentTarget.scrollTop / rowHeight)))])}
          onKeyDown={(event) => {
            const next = { ArrowDown: draft + 30, ArrowUp: draft - 30,
              Home: 30, End: 1440, PageDown: draft + 180, PageUp: draft - 180 }[event.key];
            if (next !== undefined) { event.preventDefault(); select(next); }
          }}>
          {choices.map((minutes) => <div key={minutes} id={`${id}-${minutes}`}
            role="option" aria-selected={draft === minutes}
            onClick={() => select(minutes)} className="departure-wheel-option">
            In {departureDuration(minutes)}
          </div>)}
        </div>
        <p className="departure-picker-time">{plannedDepartureDateTime(new Date(now + draft * 60000).toISOString())}</p>
        <div className="location-prompt-actions">
          <button type="button" className="primary" onClick={() => confirm(draft)}>DONE</button>
          <button type="button" className="secondary" onClick={close}>GO BACK</button>
        </div>
      </section>
    </div>, document.body,
  );
}

export default function DepartureChoice({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="payid-field">
      <button type="button" className="secondary departure-choice" aria-label={`Leaving in ${departureDuration(value)}`}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span>In {departureDuration(value)}</span><span aria-hidden="true">⌄</span>
      </button>
      {open && <DepartureWheel value={value} close={() => setOpen(false)}
        confirm={(minutes) => { onChange(minutes); setOpen(false); }} />}
    </div>
  );
}

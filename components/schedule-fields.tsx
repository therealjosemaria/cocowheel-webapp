"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import RideFieldLabel from "./ride-field-label";
import { calendarDay, dateCaption, lastDepartureDate, sydneyDateTime, sydneyInstant, timeCaption } from "@/lib/ride-schedule";

export function SearchSheet({ label, close, children, hideHeading = false }: { label: string; close: () => void; children: ReactNode; hideHeading?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, close);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fit = () => {
      const viewport = window.visualViewport;
      if (!backdrop.current || !viewport) return;
      backdrop.current.style.height = `${viewport.height}px`;
      backdrop.current.style.top = `${viewport.offsetTop}px`;
      backdrop.current.style.setProperty("--sheet-height", `${viewport.height}px`);
    };
    fit();
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);
    return () => {
      document.body.style.overflow = previous;
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
    };
  }, []);
  return createPortal(<div ref={backdrop} className="location-prompt-backdrop search-sheet-backdrop">
    <section ref={ref} tabIndex={-1} className="search-sheet" role="dialog" aria-modal="true" aria-label={label}>
      <header className="search-sheet-header"><button type="button" className="text-button" onClick={close}>Back</button>{!hideHeading && <h2>{label}</h2>}</header>
      {children}
    </section>
  </div>, document.body);
}

function DatePicker({ value, optional, close, confirm }: { value: string; optional: boolean; close: () => void; confirm: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const today = sydneyDateTime().date;
  const last = lastDepartureDate();
  const months: string[] = [];
  for (let day = `${today.slice(0, 7)}-01`; day <= last;) {
    months.push(day);
    const next = new Date(`${day}T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    day = next.toISOString().slice(0, 10);
  }
  return <SearchSheet label="Departure date" close={close}>
    {optional && <button type="button" className="secondary calendar-any-date" aria-pressed={draft === "any"} onClick={() => setDraft("any")}>Any date</button>}
    <div className="calendar-months">{months.map(month => {
      const first = new Date(`${month}T12:00:00Z`);
      const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      return <section key={month} className="calendar-month">
        <h3>{new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" }).format(first)}</h3>
        <div className="calendar-grid">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => <span key={i} aria-hidden="true">{day}</span>)}
          {Array.from({ length: (first.getUTCDay() + 6) % 7 }, (_, i) => <span key={`space-${i}`} />)}
          {Array.from({ length: count }, (_, i) => {
            const date = calendarDay(month, i);
            return <button key={date} type="button" disabled={date < today || date > last}
              aria-label={dateCaption(date)} aria-pressed={draft === date} onClick={() => setDraft(date)}>{i + 1}</button>;
          })}
        </div>
      </section>;
    })}</div>
    <footer className="search-sheet-actions"><button type="button" className="secondary" onClick={() => setDraft(today)}>RESET</button>
      <button type="button" className="primary" onClick={() => confirm(draft)}>DONE</button></footer>
  </SearchSheet>;
}

function TimePicker({ date, value, optional, close, confirm }: {
  date: string; value: string; optional: boolean; close: () => void; confirm: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const list = useRef<HTMLDivElement>(null);
  const [now] = useState(Date.now);
  useEffect(() => {
    let target = value;
    if (!target) {
      target = "00:00";
      const today = sydneyDateTime(now).date;
      if (date === "any" || date === today) {
        const next = sydneyDateTime((Math.floor(now / 1_800_000) + 1) * 1_800_000);
        target = date !== "any" && next.date !== date ? "23:30" : next.time;
      }
    }
    list.current?.querySelector(`[data-time="${target}"]`)?.scrollIntoView({ block: value ? "center" : "start" });
  }, [date, value, now]);
  return <SearchSheet label="Departure time" close={close}>
    <div className="clock-options" ref={list} onKeyDown={event => {
      const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = { ArrowDown: Math.min(index + 1, buttons.length - 1), ArrowUp: Math.max(index - 1, 0), Home: 0, End: buttons.length - 1 }[event.key];
      if (next !== undefined) { event.preventDefault(); buttons[next]?.focus(); }
    }}>
      {optional && <button type="button" aria-pressed={draft === ""} onClick={() => setDraft("")}>Any time</button>}
      {Array.from({ length: 48 }, (_, i) => {
        const time = `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
        const instant = sydneyInstant(date === "any" ? "2026-01-15" : date, time);
        return <button key={time} type="button" data-time={time} aria-pressed={draft === time}
          disabled={!instant || (!optional && Date.parse(instant) <= now)} onClick={() => setDraft(time)}>{timeCaption(time)}</button>;
      })}
    </div>
    <footer className="search-sheet-actions"><button type="button" className="secondary" onClick={close}>GO BACK</button>
      <button type="button" className="primary" disabled={!optional && (!sydneyInstant(date, draft) || Date.parse(sydneyInstant(date, draft)!) <= now)} onClick={() => confirm(draft)}>DONE</button></footer>
  </SearchSheet>;
}

export default function ScheduleFields({ date, time, setDate, setTime, optional = false }: {
  date: string; time: string; setDate: (value: string) => void; setTime: (value: string) => void; optional?: boolean;
}) {
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  return <div className="schedule-fields">
    <button type="button" className="secondary schedule-field" aria-label={`Departure date: ${date === "any" ? "Any date" : dateCaption(date)}`} aria-haspopup="dialog" onClick={() => setPicker("date")}><RideFieldLabel icon="departure">{date === "any" ? "Any date" : dateCaption(date)}</RideFieldLabel></button>
    <button type="button" className="secondary schedule-field" aria-label={`Departure time: ${time ? timeCaption(time) : "Any time"}`} aria-haspopup="dialog" onClick={() => setPicker("time")}><RideFieldLabel icon="pickup-time">{time ? `${optional ? "Around " : ""}${timeCaption(time)}` : optional ? "Any time" : "Choose a time"}</RideFieldLabel></button>
    {picker === "date" && <DatePicker value={date} optional={optional} close={() => setPicker(null)} confirm={value => { setDate(value); setPicker(null); }} />}
    {picker === "time" && <TimePicker date={date} value={time} optional={optional} close={() => setPicker(null)} confirm={value => { setTime(value); setPicker(null); }} />}
  </div>;
}

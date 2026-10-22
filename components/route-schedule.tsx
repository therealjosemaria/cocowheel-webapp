"use client";
import { useState } from "react";
import { WEEKDAYS, type UsualRoute } from "@/lib/usual-route";

export default function RouteSchedule({
  route,
  busy,
  save,
  close,
}: {
  route: UsualRoute;
  busy: boolean;
  save: (route: UsualRoute) => Promise<void>;
  close: () => void;
}) {
  const [anyTime, setAnyTime] = useState(route.anyTime === true);
  const [days, setDays] = useState(route.days);
  const [time, setTime] = useState(
    route.minute === null
      ? ""
      : `${String(Math.floor(route.minute / 60)).padStart(2, "0")}:${String(route.minute % 60).padStart(2, "0")}`,
  );
  return (
    <div className="usual-route-section">
      <label className="usual-alert-choice">
        <input
          type="checkbox"
          checked={anyTime}
          disabled={busy}
          onChange={(e) => setAnyTime(e.target.checked)}
        />
        Any day, any time
      </label>
      {!anyTime && (
        <>
          <fieldset
            className="usual-days"
            aria-label="Travel days"
            disabled={busy}
          >
            <div>
              {WEEKDAYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  className="secondary"
                  aria-pressed={days.includes(i + 1)}
                  onClick={() =>
                    setDays((old) =>
                      old.includes(i + 1)
                        ? old.filter((d) => d !== i + 1)
                        : [...old, i + 1],
                    )
                  }
                >
                  {day}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="field usual-route-time">
            <input
              type="time"
              aria-label="Usual departure time"
              value={time}
              disabled={busy}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </>
      )}
      <button
        className="primary"
        disabled={busy || (!anyTime && (!days.length || !time))}
        onClick={async () => {
          const [h, m] = time.split(":").map(Number);
          await save({
            ...route,
            anyTime,
            days: anyTime ? [] : days,
            minute: anyTime ? null : h * 60 + m,
          });
        }}
      >
        {busy ? "Saving…" : "Save schedule"}
      </button>
      <button className="secondary" disabled={busy} onClick={close}>
        Cancel
      </button>
    </div>
  );
}

"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import type { MapAvatar } from "@/lib/map-avatar";
import { notifyAvatarSaved } from "@/lib/vehicle-updates";
import RideFieldLabel from "./ride-field-label";

function AvatarPreview({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  return src && !failed
    ? <Image className="vehicle-artwork-preview" src={src} alt="Your map avatar" width={144} height={108}
        unoptimized onError={() => setFailed(true)} />
    : <span className="journey-role-art journey-role-art-rider avatar-default-preview" role="img" aria-label="Default map avatar" />;
}

export default function AvatarDetails() {
  const [saved, setSaved] = useState<MapAvatar | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const alive = useRef(false);
  const submitting = useRef(false);
  useEffect(() => {
    let live = true;
    alive.current = true;
    cocowheelsApi<MapAvatar>("/api/avatar").then(result => {
      if (live) { setSaved(result); setEnabled(result.enabled); setError(""); }
    }).catch(reason => { if (live) setError(apiErrorMessage(reason)); });
    return () => { live = false; alive.current = false; };
  }, [revision]);
  const selected = editing ? enabled : saved?.enabled;
  const preview = selected ? saved?.previewUrl ?? null : null;
  return <details className="contribution-choice profile-disclosure avatar-details">
    <summary><RideFieldLabel icon="rider">Avatar</RideFieldLabel></summary>
    <form className="vehicle-fields" onSubmit={async event => {
      event.preventDefault();
      if (submitting.current || !saved) return;
      submitting.current = true; setBusy(true); setError("");
      try {
        const result = await cocowheelsApi<MapAvatar>("/api/avatar", {
          method: "POST", body: JSON.stringify({ enabled }),
        }, true);
        if (!alive.current) return;
        setSaved(result); setEnabled(result.enabled); setEditing(false);
        notifyAvatarSaved();
      } catch (reason) {
        if (alive.current) setError(apiErrorMessage(reason));
      } finally {
        submitting.current = false;
        if (alive.current) setBusy(false);
      }
    }}>
      {error && <p role="alert">{error}</p>}
      {!saved ? error
        ? <button type="button" className="secondary" onClick={() => setRevision(value => value + 1)}>Try again</button>
        : <p>Loading…</p>
        : <>
          <AvatarPreview key={preview} src={preview} />
          {editing
            ? <label className="usual-alert-choice"><input type="checkbox" checked={enabled}
                onChange={event => { if (!submitting.current) setEnabled(event.target.checked); }} />Use personal avatar</label>
            : <dl className="profile-personal-summary"><div><dt>Personal avatar</dt><dd>{saved.enabled ? "Enabled" : "Disabled"}</dd></div></dl>}
          {saved.available && <p className="save-route-profile-note">When enabled, shown on maps, including public Home.</p>}
          {editing ? <div className="ride-action-buttons">
            <button className="primary" aria-busy={busy}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="secondary" onClick={() => {
              if (submitting.current) return;
              setEditing(false); setEnabled(saved.enabled); setError("");
            }}>Cancel</button>
          </div> : saved.available && <button type="button" className="secondary" onClick={() => setEditing(true)}>Edit</button>}
        </>}
    </form>
  </details>;
}

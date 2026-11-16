"use client";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import type { MapAvatar } from "@/lib/map-avatar";
import { notifyAvatarSaved } from "@/lib/vehicle-updates";
import RideFieldLabel from "./ride-field-label";
import { AVATAR_PHOTO_REQUIREMENTS, avatarJobActive, avatarJobCancellable, avatarJobMessage, type AvatarJobs } from "@/lib/avatar-job";
import { prepareAvatarPhoto } from "@/lib/avatar-photo";
import { useVisibleReview } from "@/lib/use-visible-review";

function AvatarPreview({ src, photo = false }: { src: string | null; photo?: boolean }) {
  const [failed, setFailed] = useState(false);
  return src && !failed
    ? <Image className="vehicle-artwork-preview" src={src} alt={photo ? "Photo to check" : "Your map avatar"} width={144} height={108}
        unoptimized onError={() => setFailed(true)} />
    : <span className="journey-role-art journey-role-art-rider avatar-default-preview" role="img" aria-label="Default map avatar" />;
}

export default function AvatarDetails() {
  const avatarEntry = useSearchParams().get("avatar") === "1";
  const [saved, setSaved] = useState<MapAvatar | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [jobs, setJobs] = useState<AvatarJobs>({ accepting: false, job: null });
  const [photo, setPhoto] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const submissionId = useRef("");
  const photoInput = useRef<HTMLInputElement>(null);
  const disclosure = useRef<HTMLDetailsElement>(null);
  const result = useRef<HTMLParagraphElement>(null);
  const mutation = useRef(0);
  const seenPreview = useRef<string | null | undefined>(undefined);
  const alive = useRef(false);
  const submitting = useRef(false);
  useEffect(() => {
    let live = true;
    alive.current = true;
    const load = () => {
      if (document.visibilityState !== "visible" || submitting.current) return;
      const version = mutation.current;
      void Promise.all([cocowheelsApi<MapAvatar>("/api/avatar"), cocowheelsApi<AvatarJobs>("/api/avatar/jobs")]).then(([avatar, state]) => {
        if (live && !submitting.current && version === mutation.current) {
          if (seenPreview.current !== undefined && seenPreview.current !== avatar.previewUrl) notifyAvatarSaved();
          seenPreview.current = avatar.previewUrl;
          setSaved(avatar); setJobs(state); setLoadError("");
        }
      }).catch(reason => { if (live && version === mutation.current) setLoadError(apiErrorMessage(reason)); });
    };
    load();
    const timer = setInterval(load, 10_000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => { live = false; alive.current = false; clearInterval(timer); window.removeEventListener("focus", load); document.removeEventListener("visibilitychange", load); };
  }, [revision]);
  useEffect(() => {
    if (!avatarEntry || !disclosure.current) return;
    disclosure.current.open = true;
    result.current?.scrollIntoView({ block: "center" });
  }, [avatarEntry, jobs.job?.id]);
  const review = useCallback((key: string) => {
    mutation.current++;
    void cocowheelsApi("/api/avatar/jobs/reviewed", { method: "POST", body: JSON.stringify({ key }) }, true).then(() => {
      if (!alive.current) return;
      setJobs(previous => ({ ...previous, job: previous.job?.notificationKey === key ? { ...previous.job, notificationKey: null } : previous.job }));
      window.dispatchEvent(new Event("cocowheels:avatar-job-changed"));
    }).catch(() => undefined);
  }, []);
  useVisibleReview(result, photo ? null : jobs.job?.notificationKey ?? null, review);
  const selected = editing ? enabled : saved?.enabled;
  const preview = selected ? saved?.previewUrl ?? null : null;
  return <details ref={disclosure} className="contribution-choice profile-disclosure avatar-details">
    <summary><RideFieldLabel icon="rider">Avatar</RideFieldLabel></summary>
    <form className="vehicle-fields" onSubmit={async event => {
      event.preventDefault();
      if (submitting.current || !saved) return;
      if (!photo && !editing) return;
      if (photo && !consent) { setError("Agree to the photo check and avatar creation before submitting."); return; }
      submitting.current = true; mutation.current++; setBusy(true); setError("");
      try {
        if (photo) {
          const state = await cocowheelsApi<AvatarJobs>("/api/avatar/jobs", {
            method: "POST", body: JSON.stringify({ photo, consent, submissionId: submissionId.current }),
          }, true);
          if (!alive.current) return;
          setJobs(state); setPhoto(null); setConsent(false);
          window.dispatchEvent(new Event("cocowheels:avatar-job-changed"));
          return;
        }
        const result = await cocowheelsApi<MapAvatar>("/api/avatar", {
          method: "POST", body: JSON.stringify({ enabled }),
        }, true);
        if (!alive.current) return;
        setSaved(result); setEnabled(result.enabled); setEditing(false);
        notifyAvatarSaved();
      } catch (reason) {
        if (photo) {
          try {
            const state = await cocowheelsApi<AvatarJobs>("/api/avatar/jobs");
            if (alive.current && state.job && avatarJobActive(state.job.status)) { setJobs(state); setPhoto(null); setConsent(false); return; }
          } catch { /* Preserve the submission ID; a manual retry cannot create a duplicate. */ }
        }
        if (alive.current) setError(apiErrorMessage(reason));
      } finally {
        submitting.current = false;
        if (alive.current) setBusy(false);
      }
    }}>
      {(error || loadError) && <p role="alert">{error || loadError}</p>}
      {!saved ? (error || loadError)
        ? <button type="button" className="secondary" onClick={() => setRevision(value => value + 1)}>Try again</button>
        : <p>Loading…</p>
        : <>
          <AvatarPreview key={photo ? "photo-to-check" : preview} src={photo ?? preview} photo={Boolean(photo)} />
          {photo ? <>
            <p className="save-route-profile-note">{AVATAR_PHOTO_REQUIREMENTS}</p>
            <p className="save-route-profile-note">Approved photos are sent to Tripo to create your avatar. You choose whether to show it on maps.</p>
            <label className="usual-alert-choice"><input type="checkbox" checked={consent}
              onChange={event => { if (!submitting.current) { setConsent(event.target.checked); setError(""); } }} />Check my photo and create my avatar if it passes.</label>
            <div className="ride-action-buttons">
              <button className="primary" aria-busy={busy}>{busy ? "Uploading…" : "Submit photo"}</button>
              <button type="button" className="secondary" onClick={() => { if (!submitting.current) { setPhoto(null); setConsent(false); setError(""); } }}>Cancel</button>
            </div>
          </> : <>
          <label className="usual-alert-choice"><input type="checkbox" checked={Boolean(selected)}
              aria-readonly={!editing || busy}
              onClick={event => { if (!editing || submitting.current) event.preventDefault(); }}
              onChange={event => { if (editing && !submitting.current) setEnabled(event.target.checked); }} />Personal avatar</label>
          {saved.available && <p className="save-route-profile-note">When enabled, shown on maps, including public Home.</p>}
          {editing ? <div className="ride-action-buttons">
            <button className="primary" aria-busy={busy}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="secondary" onClick={() => {
              if (submitting.current) return;
              setEditing(false); setEnabled(saved.enabled); setError("");
            }}>Cancel</button>
          </div> : saved.available && <button type="button" className="secondary" onClick={() => { if (!submitting.current) { setEnabled(saved.enabled); setEditing(true); } }}>Edit</button>}
          </>}
          {!photo && jobs.job && <p id="avatar-result" ref={result} role="status" className="save-route-profile-note">{avatarJobMessage(jobs.job)}
            {jobs.job.status === "REVIEW_REQUIRED" && <> <a href="mailto:jose@gumwheel.com" className="help-email">Email us</a></>}
          </p>}
          {!photo && !editing && (!jobs.job || !avatarJobActive(jobs.job.status)) && <>
            {!jobs.job && !saved.available && <p className="save-route-profile-note">{AVATAR_PHOTO_REQUIREMENTS}</p>}
            <button type="button" className="secondary" onClick={() => {
              if (!jobs.accepting) { setError("Photo uploads are temporarily unavailable. Use the default avatar and try uploading later."); return; }
              photoInput.current?.click();
            }}>{saved.available ? "Update photo" : "Upload photo"}</button>
          </>}
          {!photo && !editing && jobs.job && avatarJobCancellable(jobs.job.status) && <button type="button" className="secondary" onClick={async () => {
            if (submitting.current) return;
            submitting.current = true; mutation.current++; setError("");
            try {
              const state = await cocowheelsApi<AvatarJobs>("/api/avatar/jobs/cancel", { method: "POST", body: JSON.stringify({ id: jobs.job!.id }) }, true);
              if (alive.current) setJobs(state);
            } catch (reason) { if (alive.current) setError(apiErrorMessage(reason)); }
            finally { submitting.current = false; }
          }}>{jobs.job.status === "APPROVED" ? "Cancel creation" : "Cancel photo check"}</button>}
          <input ref={photoInput} type="file" hidden accept="image/jpeg,image/png,image/webp" aria-label="Avatar photo" onChange={async event => {
            const file = event.target.files?.[0]; event.target.value = "";
            if (!file || submitting.current) return;
            submitting.current = true; setError("");
            try {
              const prepared = await prepareAvatarPhoto(file);
              if (alive.current) { setPhoto(prepared); setConsent(false); submissionId.current = crypto.randomUUID(); }
            } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "Choose another photo."); }
            finally { submitting.current = false; }
          }} />
        </>}
    </form>
  </details>;
}

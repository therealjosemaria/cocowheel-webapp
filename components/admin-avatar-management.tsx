"use client";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import { ApiError, apiErrorMessage } from "@/lib/api-transport";
import { adminAvatarIssues, adminAvatarStatus, adminAvatarVerification, TRIPO_TOP_UP_URL, type AdminAvatarBalance, type AdminAvatarJob, type AdminAvatarJobs } from "@/lib/admin-avatar";
import { avatarJobActive, avatarRejections, avatarReviewReason, AVATAR_REVIEW_REASON_LIMIT, AVATAR_REVIEW_REASON_ERROR } from "@/lib/avatar-job";
import { useVisibleReview } from "@/lib/use-visible-review";
import ConfirmationPrompt from "./confirmation-prompt";
import { AVATAR_CREDITS } from "@/lib/avatar-generation";
import RideFieldLabel from "./ride-field-label";

function Submission({ job, act, review }: { job: AdminAvatarJob; act: (job: AdminAvatarJob, action: string) => void; review: (key: string) => void }) {
  const status = useRef<HTMLParagraphElement>(null);
  const verification = adminAvatarVerification(job);
  const phase = job.status === "REJECTED" ? "" : job.status === "APPROVED" && job.approvedAt ? "Queued for generation" : adminAvatarStatus[job.status];
  const notes = [phase, job.hold && job.hold !== "AWAITING_APPROVAL" ? adminAvatarIssues[job.hold] ?? "Review this submission before continuing." : null,
    job.reviewReason || (job.reason ? adminAvatarIssues[job.reason] ?? avatarRejections[job.reason] ?? "Review this submission before continuing." : null)].filter(Boolean).join(" · ");
  useVisibleReview(status, job.notificationKey, review);
  return <article id={`avatar-${job.id}`}>
    <h2>{job.username}</h2>
    <p ref={status} className="admin-muted admin-avatar-status">
      {verification && <span className="admin-avatar-verification"><RideFieldLabel icon={verification.icon}>{verification.label}</RideFieldLabel></span>}
      {notes && <span>{notes}</span>}
    </p>
    <div className="admin-avatar-media">
      <figure><figcaption>Submitted photo</figcaption>{job.photoUrl
        ? <Image src={job.photoUrl} alt={`Submitted photo for ${job.username}`} width={160} height={220} unoptimized />
        : <p className="admin-muted">Photo removed</p>}</figure>
      {job.renderUrl && <figure><figcaption>Generated avatar</figcaption>
        <Image src={job.renderUrl} alt={`Generated avatar for ${job.username}`} width={160} height={220} unoptimized />
      </figure>}
    </div>
    <dl className="admin-fields">
      <div><dt>Email</dt><dd>{job.email}</dd></div>
      <div><dt>Submitted</dt><dd>{new Date(job.createdAt).toLocaleString()}</dd></div>
      <div><dt>Checked</dt><dd>{job.checkedAt ? new Date(job.checkedAt).toLocaleString() : "Not recorded"}</dd></div>
      <div><dt>Check duration</dt><dd>{job.checkDurationMs != null ? `${(job.checkDurationMs / 1000).toFixed(1)} s` : "Not recorded"}</dd></div>
      <div><dt>Generation approval</dt><dd>{job.approvedAt ? new Date(job.approvedAt).toLocaleString() : "Not approved"}</dd></div>
      <div><dt>Task</dt><dd>{job.taskId ?? "Not submitted"}</dd></div>
    </dl>
    {(avatarJobActive(job.status) || job.status === "FAILED") && <div className="ride-action-buttons">
      {job.status === "APPROVED" && !job.approvedAt && <button type="button" className="primary" onClick={() => act(job, "approve")}>Approve generation</button>}
      {job.status === "APPROVED" && <button type="button" className="secondary" onClick={() => act(job, "reject")}>Reject photo</button>}
      {job.hold === "CHECK_UNAVAILABLE" && <button type="button" className="secondary" onClick={() => act(job, "retry-check")}>Retry photo check</button>}
      <button type="button" className="secondary" onClick={() => act(job, "cancel")}>Cancel creation</button>
    </div>}
  </article>;
}
function TripoBalance({ jobs }: { jobs: AdminAvatarJobs }) {
  const [balance, setBalance] = useState<AdminAvatarBalance | null>(null);
  const [details, setDetails] = useState<Pick<AdminAvatarJobs, "model" | "creditsPerAvatar" | "workerSeenAt"> | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const load = async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller; setBusy(true);
    // Freeze the existing local metadata on this explicit click. Submission polling
    // must not silently update this panel or cause another provider request.
    setDetails({ model: jobs.model, creditsPerAvatar: jobs.creditsPerAvatar, workerSeenAt: jobs.workerSeenAt });
    try {
      const value = await adminApi<AdminAvatarBalance>("avatar-jobs/balance", undefined, controller.signal);
      if (!controller.signal.aborted) { setBalance(value); setUnavailable(value.availableCredits === null); }
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) window.location.replace("/admin/avatar-management");
        setBalance(null); setUnavailable(true);
      }
    } finally { request.current = null; if (!controller.signal.aborted) setBusy(false); }
  };
  return <section aria-label="Tripo balance">
    {details && <>
    <p className="admin-muted">{details.model} · {details.creditsPerAvatar} credits per avatar.<br />
      Photo checker: {details.workerSeenAt ? `last connected ${new Date(details.workerSeenAt).toLocaleString()}` : "not connected yet"}.</p>
    <dl className="admin-fields">
      <div><dt>Tripo API balance</dt><dd>{balance?.availableCredits != null
        ? `${balance.availableCredits.toLocaleString()} credits (US$${(balance.availableCredits / 100).toFixed(2)})` : unavailable ? "Unavailable" : "Checking…"}</dd></div>
      <div><dt>Checked</dt><dd>{balance?.checkedAt ? new Date(balance.checkedAt).toLocaleString() : "Not available"}</dd></div>
      {!!balance?.frozenCredits && <div><dt>Reserved for tasks</dt><dd>{balance.frozenCredits.toLocaleString()} credits</dd></div>}
    </dl>
    {unavailable && <p className="admin-muted" role="status">Couldn’t check the balance. Refresh or open Tripo to check it.</p>}
    </>}
    <div className="ride-action-buttons">
      <button type="button" className="secondary" aria-busy={busy} onClick={() => void load()}>{busy ? "Checking…" : details ? "Refresh balance" : "Check balance"}</button>
      <a className="secondary" href={TRIPO_TOP_UP_URL} target="_blank" rel="noopener noreferrer">Top up Tripo</a>
    </div>
  </section>;
}
export default function AdminAvatarManagement() {
  const focus = useSearchParams().get("job") ?? "";
  return <AvatarManagementList key={focus} focus={focus} />;
}
function AvatarManagementList({ focus }: { focus: string }) {
  const [data, setData] = useState<AdminAvatarJobs | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [revision, setRevision] = useState(0);
  const [prompt, setPrompt] = useState<{ job: AdminAvatarJob; action: string } | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const sequence = useRef(0);
  const scrolled = useRef("");
  const alive = useRef(false);
  const fail = useCallback((reason: unknown, action = false) => {
    if (reason instanceof Error && reason.name === "AbortError") return;
    if (reason instanceof ApiError && [401, 403].includes(reason.status)) window.location.replace("/admin/avatar-management");
    else (action ? setActionError : setError)(reason instanceof ApiError && reason.code === "AVATAR_JOB_CHANGED"
      ? "This submission changed. Review its latest status before continuing."
      : reason instanceof ApiError && reason.code === "AVATAR_REVIEW_TOO_LATE" ? "Generation has started. Use Cancel creation to stop delivery."
      : action ? "Couldn’t confirm this action. Review the latest status before trying again."
      : apiErrorMessage(reason, "Couldn’t load avatar submissions. Try again."));
  }, []);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    let running = false;
    const load = async () => {
      if (document.hidden || submitting.current || running) return;
      running = true;
      const version = ++sequence.current;
      try {
        const value = await adminApi<AdminAvatarJobs>(`avatar-jobs?page=${page}&job=${encodeURIComponent(focus)}`, undefined, controller.signal);
        if (!controller.signal.aborted && version === sequence.current) { setData(value); setError(""); }
      } catch (reason) { if (!controller.signal.aborted && version === sequence.current) fail(reason); }
      finally { running = false; }
    };
    void load();
    const timer = setInterval(() => void load(), 10_000);
    document.addEventListener("visibilitychange", load); window.addEventListener("focus", load);
    return () => { alive.current = false; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", load); window.removeEventListener("focus", load); };
  }, [page, focus, revision, fail]);
  useEffect(() => {
    if (focus && data?.jobs.some(job => job.id === focus) && scrolled.current !== focus) {
      scrolled.current = focus;
      document.getElementById(`avatar-${focus}`)?.scrollIntoView({ block: "start" });
    }
  }, [data, focus]);
  const review = useCallback((key: string) => {
    const version = ++sequence.current;
    void adminApi("avatar-jobs/reviewed", { key }).then(() => {
      if (!alive.current || version !== sequence.current) return;
      setData(old => old ? { ...old, jobs: old.jobs.map(job => job.notificationKey === key ? { ...job, notificationKey: null } : job) } : old);
      window.dispatchEvent(new Event("cocowheels:avatar-job-changed"));
    }).catch(() => undefined);
  }, []);
  const confirm = async () => {
    if (!prompt || submitting.current) return;
    if (prompt.action === "reject" && !avatarReviewReason(reason)) { setReasonError(AVATAR_REVIEW_REASON_ERROR); return; }
    submitting.current = true; sequence.current++; setBusy(true); setActionError("");
    try {
      await adminApi(`avatar-jobs/${prompt.job.id}/${prompt.action}`, prompt.action === "reject" ? { reason } : {});
      if (alive.current) { setPrompt(null); setRevision(value => value + 1); window.dispatchEvent(new Event("cocowheels:avatar-job-changed")); }
    } catch (error) { if (alive.current) {
      if (error instanceof ApiError && error.code === "INVALID_AVATAR_REVIEW_REASON") setReasonError(AVATAR_REVIEW_REASON_ERROR);
      else { setPrompt(null); fail(error, true); setRevision(value => value + 1); }
    } }
    finally { submitting.current = false; if (alive.current) setBusy(false); }
  };
  return <section className="page-content"><div className="admin-panel demand-detail-content admin-avatar-management">
    <Link href="/admin" className="text-button">Back</Link>
    <header className="admin-heading"><h1>Avatar management</h1></header>
    <p className="admin-muted">Photo checks run automatically. Generation starts only after your approval.</p>
    {(error || actionError) && <p role="alert" className="admin-message">{actionError || error} <button type="button" className="text-button" onClick={() => { setActionError(""); setRevision(value => value + 1); }}>Refresh</button></p>}
    {!data ? !error && <p className="admin-muted">Loading…</p> : <>
      <TripoBalance jobs={data} />
      <div className="admin-records">{data.jobs.map(job => <Submission key={job.id} job={job} act={(value, action) => { if (!submitting.current) { setReason(""); setReasonError(""); setPrompt({ job: value, action }); } }} review={review} />)}</div>
      {data.total === 0 && <p className="admin-muted">No avatar photos submitted yet.</p>}
      {data.total > 25 && <nav className="admin-pagination" aria-label="Avatar pages">
        <button type="button" className="secondary" onClick={() => { if (page > 0) setPage(value => value - 1); }}>Previous</button>
        <span>Page {data.page + 1}</span>
        <button type="button" className="secondary" onClick={() => { if ((page + 1) * 25 < data.total) setPage(value => value + 1); }}>Next</button>
      </nav>}
    </>}
    {prompt && <ConfirmationPrompt busy={busy} close={() => { if (!submitting.current) setPrompt(null); }} confirm={() => void confirm()}
      label={prompt.action === "approve" ? `Approve this avatar’s generation with ${data?.creditsPerAvatar ?? AVATAR_CREDITS} Tripo credits?`
        : prompt.action === "reject" ? "Reject this photo? Your reason will be shown to the user."
        : prompt.action === "retry-check" ? "Queue this photo for another requirements check?"
        : prompt.job.taskId || prompt.job.status === "SUBMITTING" || prompt.job.status === "REVIEW_REQUIRED"
          ? "Cancel this creation? Tripo may already be processing it. Any charge already incurred cannot be undone here; the result won’t be assigned."
          : "Cancel this avatar creation? The submitted photo will be removed."}
      action={prompt.action === "approve" ? "Approve generation" : prompt.action === "reject" ? "Reject photo" : prompt.action === "retry-check" ? "Retry photo check" : "Cancel creation"}
      destructive={prompt.action === "cancel" || prompt.action === "reject"}>
      {prompt.action === "reject" && <>
        <label className="field">Reason
          <textarea value={reason} maxLength={AVATAR_REVIEW_REASON_LIMIT} rows={3} aria-required="true" aria-invalid={!!reasonError}
            aria-describedby={reasonError ? "avatar-review-error" : undefined} onChange={event => { setReason(event.target.value); setReasonError(""); }} />
        </label>
        {reasonError && <p id="avatar-review-error" role="alert" className="admin-message">{reasonError}</p>}
      </>}
    </ConfirmationPrompt>}
  </div></section>;
}

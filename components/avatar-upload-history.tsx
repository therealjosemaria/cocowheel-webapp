"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import { avatarHistoryStatus, avatarJobMessage, type AvatarHistory } from "@/lib/avatar-job";
import RideFieldLabel from "./ride-field-label";

function HistoryPhoto({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  return src && !failed
    ? <Image src={src} alt="Submitted photo" width={64} height={96} unoptimized onError={() => setFailed(true)} />
    : <span className="avatar-history-photo-removed">{failed ? "Preview unavailable. Reopen to retry." : "Photo removed"}</span>;
}
export default function AvatarUploadHistory({ revision }: { revision: string }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; data?: AvatarHistory; error?: string } | null>(null);
  const key = `${page}:${revision}:${retry}`;
  useEffect(() => {
    if (!open) return;
    let live = true;
    const controller = new AbortController();
    void cocowheelsApi<AvatarHistory>(`/api/avatar/history?page=${page}`, { signal: controller.signal })
      .then(data => { if (live) setLoaded({ key, data }); })
      .catch(reason => { if (live) setLoaded({ key, error: apiErrorMessage(reason) }); });
    return () => { live = false; controller.abort(); };
  }, [open, page, key]);
  const data = loaded?.key === key ? loaded.data : undefined;
  const error = loaded?.key === key ? loaded.error : undefined;
  return <details className="contribution-choice avatar-upload-history" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Upload history</summary>
    {open && <div className="avatar-history-content">
      {error ? <><p role="alert">{error}</p><button type="button" className="secondary" onClick={() => setRetry(value => value + 1)}>Try again</button></>
        : !data ? <p role="status">Loading…</p>
        : <>
          {data.items.length === 0 && <p>No uploads yet.</p>}
          {data.items.map(item => <article className="avatar-history-entry" key={item.id}>
            <HistoryPhoto key={item.thumbnailUrl} src={item.thumbnailUrl} />
            <div>
              <p className="avatar-history-outcome"><RideFieldLabel icon={item.status === "REJECTED" ? "rejected" : ["READY", "APPROVED", "SUBMITTING", "GENERATING"].includes(item.status) ? "accepted" : "requested"}>
                {avatarHistoryStatus[item.status]}
              </RideFieldLabel></p>
              <p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</time></p>
            </div>
            <p className="avatar-history-message">{avatarJobMessage({ ...item, notificationKey: null })}</p>
          </article>)}
          {(page > 0 || (page + 1) * data.pageSize < data.total) && <div className="ride-action-buttons">
            {page > 0 && <button type="button" className="secondary" onClick={() => setPage(value => value - 1)}>Newer</button>}
            {(page + 1) * data.pageSize < data.total && <button type="button" className="secondary" onClick={() => setPage(value => value + 1)}>Older</button>}
          </div>}
        </>}
    </div>}
  </details>;
}

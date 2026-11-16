"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

type PhotoDraft = { owner: string; photo: string; submissionId: string };
type DraftStore = {
  remember: (value: PhotoDraft) => void;
  read: (owner: string) => PhotoDraft | null;
  clear: () => void;
};
const PhotoDrafts = createContext<DraftStore | null>(null);
const TTL = 30 * 60_000;

/** Tab memory only: never serialize a private photo into storage or history. */
export function AvatarPhotoDraftProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const draft = useRef<(PhotoDraft & { expiresAt: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => {
    draft.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const remember = useCallback((value: PhotoDraft) => {
    clear();
    draft.current = { ...value, expiresAt: Date.now() + TTL };
    timer.current = setTimeout(clear, TTL);
  }, [clear]);
  const read = useCallback((owner: string) => {
    const value = draft.current;
    if (!value || value.owner !== owner || value.expiresAt <= Date.now()) { clear(); return null; }
    return value;
  }, [clear]);
  useEffect(() => {
    if (pathname !== "/usual-route" && pathname !== "/avatar-photo-guide") clear();
  }, [pathname, clear]);
  useEffect(() => {
    window.addEventListener("cocowheels:identity-changed", clear);
    window.addEventListener("pagehide", clear);
    return () => {
      clear();
      window.removeEventListener("cocowheels:identity-changed", clear);
      window.removeEventListener("pagehide", clear);
    };
  }, [clear]);
  const store = useMemo(() => ({ remember, read, clear }), [remember, read, clear]);
  return <PhotoDrafts.Provider value={store}>{children}</PhotoDrafts.Provider>;
}

export function useAvatarPhotoDraft() {
  const store = useContext(PhotoDrafts);
  if (!store) throw new Error("Avatar photo drafts require their provider");
  return store;
}

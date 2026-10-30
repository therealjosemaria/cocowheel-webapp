"use client";
import ParticipantName from "./participant-name";
import ProfileMenuPhoto from "./profile-menu-photo";
import { RatingBadge } from "./ride-rating";
import type { RatingSummary } from "@/lib/rating-types";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { journeyUpdates, journeyUpdatesHref } from "@/lib/journey-updates";
import { usePublishJourneyUpdates } from "./journey-update-context";
import RideUpdateNotice, { readSeen } from "./ride-update-notice";
import { ApiError, apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import { requestJson } from "@/lib/api-transport";
import type { ActiveRide } from "./active-ride-link";
import type { RiderDemand, DemandActivity } from "@/lib/rider-demand";
import { activeRideTabForPath } from "@/lib/navigation-state";

export default function AppNavigation() {
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [accountKey, setAccountKey] = useState<string | null>(null);
  const [ratings, setRatings] = useState<{
    driver: RatingSummary;
    rider: RatingSummary;
  } | null>(null);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [activePost, setActivePost] = useState<RiderDemand | null>(null);
  const [demandOffers, setDemandOffers] = useState(0);
  const [currents, setCurrents] = useState<ActiveRide[]>([]);
  const [demandActivity, setDemandActivity] = useState<DemandActivity | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const seenAccount = useRef<string | null>(null);
  const reviewMemory = useRef<{ account: string | null; keys: string[] }>({ account: null, keys: [] });
  const loadSequence = useRef(0);
  const { groups, notices: updates } = useMemo(
    () => journeyUpdates(currents, demandActivity, seen),
    [currents, demandActivity, seen],
  );
  const updateCount = groups.length;
  const publishUpdates = usePublishJourneyUpdates();
  useEffect(() => { publishUpdates(groups); }, [groups, publishUpdates]);
  const markSeen = useCallback(
    (key: string) => {
      if (!accountKey) return;
      reviewMemory.current = { account: accountKey, keys: Array.from(new Set([
        ...(reviewMemory.current.account === accountKey ? reviewMemory.current.keys : []), key,
      ])).slice(-500) };
      setSeen((previous) => {
        const next = Array.from(
          new Set([...readSeen(accountKey), ...previous, key]),
        ).slice(-500);
        try {
          localStorage.setItem(
            `cocowheels:seen-updates:v1:${accountKey}`,
            JSON.stringify(next),
          );
        } catch {
          /* In-memory fallback. */
        }
        return next;
      });
      // No sign-in replay: the server acknowledges only this account's keys.
      // Local persistence allows the normal identity poll to retry failed acks.
      void cocowheelsApi("/api/notifications/reviewed", {
        method: "POST", body: JSON.stringify({ keys: [key] }),
      }, true).catch(() => undefined);
    },
    [accountKey],
  );
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (accountKey && event.key === `cocowheels:seen-updates:v1:${accountKey}`)
        setSeen(readSeen(accountKey));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [accountKey]);
  const [rideTab, setRideTab] = useState<"driver" | "rider" | null>(null);
  const identityRef = useRef<HTMLDivElement>(null);
  const identityCloseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(identityCloseTimer.current), []);
  const pathname = usePathname();
  const activeRideTab = activeRideTabForPath(pathname, rideTab);
  const router = useRouter();
  const links = [
    { href: "/", label: "Home" },
    { href: "/help", label: "How it works" },
    { href: "/activity", label: "Activity" },
  ];
  const goHome = () => {
    setRideTab(null);
    if (pathname === "/") {
      window.location.assign("/");
    } else {
      router.push("/");
    }
  };
  const startRide = (role: "driver" | "rider") => {
    setRideTab(role);
    setOpen(false);
    if (pathname === "/") {
      window.dispatchEvent(
        new CustomEvent("cocowheels:start", { detail: role }),
      );
      return;
    }
    router.push(`/?start=${role}`);
  };

  useEffect(() => {
    const syncRideTab = (event: Event) => {
      const tab = (event as CustomEvent<unknown>).detail;
      if (tab === "driver" || tab === "rider") setRideTab(tab);
      if (tab === "home") setRideTab(null);
    };
    window.addEventListener("cocowheels:ride-tab", syncRideTab);
    return () => window.removeEventListener("cocowheels:ride-tab", syncRideTab);
  }, []);

  const isLinkActive = (href: string) =>
    href === "/"
      ? pathname === "/" && rideTab === null
      : pathname === href || pathname.startsWith(`${href}/`);

  const loadIdentities = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const result = await cocowheelsApi<{
        unikey: string;
        username?: string;
        ratings?: { driver: RatingSummary; rider: RatingSummary };
      }>("/api/university/session");
      if (sequence !== loadSequence.current) return;
      setGuestName(result.username ?? result.unikey);
      setAccountKey(result.unikey);
      if (seenAccount.current !== result.unikey) {
        seenAccount.current = result.unikey;
        setActiveRide(null);
        setActivePost(null);
        setCurrents([]);
        setDemandActivity(null);
        setDemandOffers(0);
        setSeen(readSeen(result.unikey));
      }
      setRatings(result.ratings ?? null);
      const reviews = await cocowheelsApi<{ keys?: string[] }>("/api/notifications/reviewed", {}, true).catch(() => null);
      if (sequence !== loadSequence.current) return;
      if (reviews?.keys) {
        const local = Array.from(new Set([...readSeen(result.unikey),
          ...(reviewMemory.current.account === result.unikey ? reviewMemory.current.keys : []),
        ])).slice(-500);
        const known = new Set(reviews.keys);
        const pending = local.filter(key => !known.has(key));
        // Batches fit the existing 32KiB JSON limit even for maximum-length keys.
        if (pending.length) void (async () => {
          for (let i = 0; i < pending.length; i += 100) {
            if (seenAccount.current !== result.unikey) return;
            await cocowheelsApi("/api/notifications/reviewed", {
              method: "POST", body: JSON.stringify({ keys: pending.slice(i, i + 100) }),
            }, true);
          }
        })().catch(() => undefined);
        setSeen(previous => Array.from(new Set([...[...reviews.keys!].reverse(), ...local, ...previous])).slice(-500));
      }
      const activity = await cocowheelsApi<{
        current: ActiveRide | null;
        currents: ActiveRide[];
        pendingDemandOffers?: number;
        activeDemand?: RiderDemand | null;
      }>("/api/current");
      if (sequence !== loadSequence.current) return;
      setActiveRide(activity.current);
      setActivePost(activity.activeDemand ?? null);
      setCurrents(activity.currents ?? (activity.current ? [activity.current] : []));
      setDemandOffers(activity.pendingDemandOffers ?? 0);
      window.dispatchEvent(
        new CustomEvent("cocowheels:current-updated", {
          detail: activity.currents,
        }),
      );
      if (activity.pendingDemandOffers) {
        const demands = await cocowheelsApi<DemandActivity>("/api/rider-demands");
        if (sequence !== loadSequence.current) return;
        setDemandActivity(demands);
      } else setDemandActivity(null);
    } catch (reason) {
      if (sequence !== loadSequence.current) return;
      if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
        setGuestName(null);
        setDemandOffers(0);
        setActivePost(null);
        setAccountKey(null);
        setRatings(null);
        setActiveRide(null);
        setCurrents([]);
        setDemandActivity(null);
        setSeen([]);
        seenAccount.current = null;
        window.dispatchEvent(
          new CustomEvent("cocowheels:current-updated", { detail: [] }),
        );
      }
    }
  }, []);

  useEffect(() => {
    const refresh = () => void loadIdentities();
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("cocowheels:identity-changed", refresh);
    window.addEventListener("cocowheels:profile-changed", refresh);
    window.addEventListener("cocowheels:messages-updated", refresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("cocowheels:identity-changed", refresh);
      window.removeEventListener("cocowheels:profile-changed", refresh);
      window.removeEventListener("cocowheels:messages-updated", refresh);
    };
  }, [loadIdentities]);

  useEffect(() => {
    if (!identityOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!identityRef.current?.contains(event.target as Node))
        setIdentityOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIdentityOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [identityOpen]);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const identityLabel = guestName ?? "No guest name yet";

  return (
    <div className="navigation-actions">
      <RideUpdateNotice updates={updates} onSeen={markSeen} />
      <nav aria-label="Primary navigation" className="desktop-navigation">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              isLinkActive(link.href)
                ? "desktop-navigation-link active"
                : "desktop-navigation-link"
            }
            aria-current={isLinkActive(link.href) ? "page" : undefined}
            onClick={(event) => {
              if (link.href !== "/") setRideTab(null);
              if (link.href === "/") {
                event.preventDefault();
                goHome();
              }
            }}
          >
            {link.label}
          </Link>
        ))}
        <button
          type="button"
          className={
            activeRideTab === "rider"
              ? "desktop-navigation-cta find active"
              : "desktop-navigation-cta find"
          }
          onClick={() => startRide("rider")}
          aria-pressed={activeRideTab === "rider"}
        >
          Find a journey
        </button>
        <button
          type="button"
          className={
            activeRideTab === "driver"
              ? "desktop-navigation-cta active"
              : "desktop-navigation-cta"
          }
          onClick={() => startRide("driver")}
          aria-pressed={activeRideTab === "driver"}
        >
          Post a journey
        </button>
      </nav>
      <div
        className={`guest-identity${identityOpen ? " open" : ""}`}
        ref={identityRef}
        onMouseEnter={() => {
          clearTimeout(identityCloseTimer.current);
          if (window.matchMedia("(hover: hover)").matches)
            setIdentityOpen(true);
        }}
        onMouseLeave={() => {
          if (window.matchMedia("(hover: hover)").matches) {
            clearTimeout(identityCloseTimer.current);
            identityCloseTimer.current = setTimeout(() => {
              if (!identityRef.current?.contains(document.activeElement))
                setIdentityOpen(false);
            }, 350);
          }
        }}
      >
        <button
          type="button"
          className="guest-identity-button"
          aria-expanded={identityOpen}
          aria-controls="guest-identity-popover"
          aria-label={`Profile: ${identityLabel}${updateCount ? `, ${updateCount} updates` : ""}`}
          onClick={() => {
            clearTimeout(identityCloseTimer.current);
            setOpen(false);
            // Hover opens this on desktop before click fires; don't immediately
            // close it again when the user clicks to reach verification.
            setIdentityOpen((current) =>
              window.matchMedia("(hover: hover)").matches ? true : !current,
            );
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
          </svg>
          {guestName && (
            <ProfileMenuPhoto key={guestName} username={guestName} />
          )}
          {updateCount > 0 && (
            <span className="profile-update-badge" aria-hidden="true">
              {updateCount > 99
                ? "99+"
                : updateCount}
            </span>
          )}
        </button>
        <div
          id="guest-identity-popover"
          className="guest-identity-popover"
          aria-hidden={!identityOpen}
        >
          <strong>Profile</strong>
          {guestName ? (
            <div className="guest-identity-row">
              <span>Username</span>
              <b><ParticipantName key={guestName} name={guestName} /></b>
              <span className="profile-verification">
                Email verified
              </span>
            </div>
          ) : (
            <>
              <button
                className="secondary"
                onClick={() => {
                  setIdentityOpen(false);
                  window.dispatchEvent(
                    new CustomEvent("cocowheels:verify-university"),
                  );
                }}
              >
                Sign in
              </button>
            </>
          )}
          {guestName && ratings && (
            <div className="profile-ratings">
              <div>
                As a driver <RatingBadge summary={ratings.driver} />
                {!ratings.driver && <span>Not enough ratings yet</span>}
              </div>
              <div>
                As a rider <RatingBadge summary={ratings.rider} />
                {!ratings.rider && <span>Not enough ratings yet</span>}
              </div>
            </div>
          )}
          {guestName && (activePost || activeRide || demandOffers > 0) && <section className="profile-current-items" aria-label="Your journeys">
            <Link className="secondary profile-active-ride" href={journeyUpdatesHref(groups)} onClick={() => setIdentityOpen(false)}>
              Your journeys
              {updateCount > 0 && (
                <span className="active-ride-update">
                  {updateCount} update{updateCount === 1 ? "" : "s"} to review
                </span>
              )}
            </Link>
          </section>}
          {guestName && (
            <div className="profile-actions">
              <Link
                className="secondary"
                href="/usual-route"
                onClick={() => setIdentityOpen(false)}
              >
                Profile
              </Link>
              <button
                className="secondary"
                disabled={signingOut}
                onClick={async () => {
                  setSigningOut(true);
                  setLogoutError(null);
                  try {
                    await requestJson("/api/university/logout", {
                      method: "POST",
                      headers: { "X-Cocowheels-Auth": "1" },
                      credentials: "same-origin",
                    });
                    try {
                      sessionStorage.removeItem("cocowheels:guest-session");
                    } catch {
                      /* Cookies remain authoritative. */
                    }
                    window.location.assign("/");
                  } catch (reason) {
                    setLogoutError(
                      apiErrorMessage(
                        reason,
                        "We couldn’t sign you out. Please try again.",
                      ),
                    );
                  } finally {
                    setSigningOut(false);
                  }
                }}
              >
                Sign out
              </button>
            </div>
          )}
          {logoutError ? <p role="alert">{logoutError}</p> : null}
        </div>
      </div>
      <button
        type="button"
        className="menu-toggle"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => {
          setIdentityOpen(false);
          setOpen((current) => !current);
        }}
      >
        <span className="menu-lines" aria-hidden="true">
          <span className={open ? "menu-line top open" : "menu-line top"} />
          <span
            className={open ? "menu-line middle open" : "menu-line middle"}
          />
          <span
            className={open ? "menu-line bottom open" : "menu-line bottom"}
          />
        </span>
      </button>
      <div
        className={open ? "menu-backdrop open" : "menu-backdrop"}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      >
        <div
          id="mobile-navigation"
          className={open ? "mobile-navigation open" : "mobile-navigation"}
          onClick={(event) => event.stopPropagation()}
        >
          <nav aria-label="Mobile navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  isLinkActive(link.href)
                    ? "mobile-navigation-link active"
                    : "mobile-navigation-link"
                }
                aria-current={isLinkActive(link.href) ? "page" : undefined}
                onClick={(event) => {
                  setOpen(false);
                  if (link.href !== "/") setRideTab(null);
                  if (link.href === "/") {
                    event.preventDefault();
                    goHome();
                  }
                }}
                tabIndex={open ? undefined : -1}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              className={
                activeRideTab === "rider"
                  ? "mobile-navigation-link active"
                  : "mobile-navigation-link"
              }
              onClick={() => startRide("rider")}
              aria-pressed={activeRideTab === "rider"}
              tabIndex={open ? undefined : -1}
            >
              Find a journey
            </button>
            <button
              type="button"
              className={
                activeRideTab === "driver"
                  ? "mobile-navigation-link active"
                  : "mobile-navigation-link"
              }
              onClick={() => startRide("driver")}
              aria-pressed={activeRideTab === "driver"}
              tabIndex={open ? undefined : -1}
            >
              Post a journey
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

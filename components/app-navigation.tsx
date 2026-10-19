"use client";
import { RatingBadge } from "./ride-rating";
import type { RatingSummary } from "@/lib/rating-types";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rideUpdates } from "@/lib/ride-updates";
import { conversationTarget } from "@/lib/messaging-types";
import RideUpdateNotice, { readSeen } from "./ride-update-notice";
import { ApiError, apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import { requestJson } from "@/lib/api-transport";
import ActiveRideLink, { type ActiveRide } from "./active-ride-link";
import { activeRideTabForPath } from "@/lib/navigation-state";

export default function AppNavigation() {
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [canAdmin, setCanAdmin] = useState(false);
  const [ratings, setRatings] = useState<{
    driver: RatingSummary;
    rider: RatingSummary;
  } | null>(null);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const seenAccount = useRef<string | null>(null);
  const messageThreads =
    activeRide?.ride.conversations?.filter((c) => c.unread > 0) ?? [];
  const messageCount = messageThreads.reduce((n, c) => n + c.unread, 0);
  const updates = useMemo(
    () => rideUpdates(activeRide).filter((u) => !seen.includes(u.key)),
    [activeRide, seen],
  );
  const markSeen = useCallback(
    (key: string) => {
      if (!guestName) return;
      setSeen((previous) => {
        const next = Array.from(
          new Set([...readSeen(guestName), ...previous, key]),
        ).slice(-500);
        try {
          localStorage.setItem(
            `cocowheels:seen-updates:v1:${guestName}`,
            JSON.stringify(next),
          );
        } catch {
          /* In-memory fallback. */
        }
        return next;
      });
    },
    [guestName],
  );
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (guestName && event.key === `cocowheels:seen-updates:v1:${guestName}`)
        setSeen(readSeen(guestName));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [guestName]);
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
    try {
      const result = await cocowheelsApi<{
        unikey: string;
        canAdmin: boolean;
        ratings?: { driver: RatingSummary; rider: RatingSummary };
      }>("/api/university/session");
      setGuestName(result.unikey);
      if (seenAccount.current !== result.unikey) {
        seenAccount.current = result.unikey;
        setActiveRide(null);
        setSeen(readSeen(result.unikey));
      }
      setCanAdmin(result.canAdmin === true);
      setRatings(result.ratings ?? null);
      const activity = await cocowheelsApi<{
        current: ActiveRide | null;
        currents: ActiveRide[];
      }>("/api/current");
      setActiveRide(activity.current);
      window.dispatchEvent(
        new CustomEvent("cocowheels:current-updated", {
          detail: activity.currents,
        }),
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setGuestName(null);
        setCanAdmin(false);
        setRatings(null);
        setActiveRide(null);
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
    window.addEventListener("cocowheels:messages-updated", refresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("cocowheels:identity-changed", refresh);
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
            activeRideTab === "driver"
              ? "desktop-navigation-cta active"
              : "desktop-navigation-cta"
          }
          onClick={() => startRide("driver")}
          aria-pressed={activeRideTab === "driver"}
        >
          Offer a ride
        </button>
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
          Find a ride
        </button>
        {canAdmin && (
          <Link
            href="/admin"
            className={`desktop-navigation-link${isLinkActive("/admin") ? " active" : ""}`}
            aria-current={isLinkActive("/admin") ? "page" : undefined}
            onClick={() => setRideTab(null)}
          >
            Admin
          </Link>
        )}
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
          aria-label={`Profile: ${identityLabel}${updates.length + messageCount ? `, ${updates.length + messageCount} unread updates` : ""}`}
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
          {updates.length + messageCount > 0 && (
            <span className="profile-update-badge" aria-hidden="true">
              {updates.length + messageCount > 99
                ? "99+"
                : updates.length + messageCount}
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
              <span>UniKey</span>
              <b>{guestName}</b>
              <span className="profile-verification">
                {/^[a-z]{4}\d{4}$/.test(guestName)
                  ? "University email verified"
                  : "Email verified"}
              </span>
            </div>
          ) : (
            <>
              <p>For University of Sydney students only.</p>
              <button
                className="secondary"
                onClick={() => {
                  setIdentityOpen(false);
                  window.dispatchEvent(
                    new CustomEvent("cocowheels:verify-university"),
                  );
                }}
              >
                Verify UniKey
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
          {guestName && activeRide && (
            <ActiveRideLink
              item={activeRide}
              compact
              notification={
                messageCount
                  ? `${messageCount} unread message${messageCount === 1 ? "" : "s"}`
                  : updates[0]?.driver
                    ? `${updates.length} new rider request${updates.length === 1 ? "" : "s"}`
                    : updates[0]?.message
              }
              notificationTarget={
                messageThreads[0]
                  ? conversationTarget(messageThreads[0].requestId)
                  : updates[0]?.target
              }
              onClick={() => {
                setIdentityOpen(false);
                if (messageThreads[0])
                  window.dispatchEvent(
                    new CustomEvent("cocowheels:open-conversation", {
                      detail: conversationTarget(messageThreads[0].requestId),
                    }),
                  );
              }}
            />
          )}
          {guestName && (
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
                activeRideTab === "driver"
                  ? "mobile-navigation-link active"
                  : "mobile-navigation-link"
              }
              onClick={() => startRide("driver")}
              aria-pressed={activeRideTab === "driver"}
              tabIndex={open ? undefined : -1}
            >
              Offer a ride
            </button>
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
              Find a ride
            </button>
            {canAdmin && (
              <Link
                href="/admin"
                className={`mobile-navigation-link${isLinkActive("/admin") ? " active" : ""}`}
                aria-current={isLinkActive("/admin") ? "page" : undefined}
                tabIndex={open ? undefined : -1}
                onClick={() => {
                  setOpen(false);
                  setRideTab(null);
                }}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, cocowheelsApi } from "@/lib/api-client";

export default function AppNavigation() {
  const [open, setOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [rideTab, setRideTab] = useState<"driver" | "rider" | null>(null);
  const identityRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const links = [
    { href: "/", label: "Home" },
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
      : pathname === "/activity" || pathname.startsWith("/activity/");

  const loadIdentities = useCallback(async () => {
    if (pathname.startsWith("/admin")) return;
    try {
      const result = await cocowheelsApi<{
        guestAlias: string;
      }>("/api/current");
      setGuestName(result.guestAlias);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setGuestName(null);
      }
    }
  }, [pathname]);

  useEffect(() => {
    const refresh = () => void loadIdentities();
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("cocowheels:identity-changed", refresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("cocowheels:identity-changed", refresh);
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
              if (link.href === "/activity") setRideTab(null);
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
            rideTab === "driver"
              ? "desktop-navigation-cta active"
              : "desktop-navigation-cta"
          }
          onClick={() => startRide("driver")}
          aria-pressed={rideTab === "driver"}
        >
          Offer a ride
        </button>
        <button
          type="button"
          className={
            rideTab === "rider"
              ? "desktop-navigation-cta find active"
              : "desktop-navigation-cta find"
          }
          onClick={() => startRide("rider")}
          aria-pressed={rideTab === "rider"}
        >
          Find a ride
        </button>
      </nav>
      <div
        className={`guest-identity${identityOpen ? " open" : ""}`}
        ref={identityRef}
        onMouseEnter={() => {
          if (window.matchMedia("(hover: hover)").matches)
            setIdentityOpen(true);
        }}
        onMouseLeave={() => {
          if (window.matchMedia("(hover: hover)").matches)
            setIdentityOpen(false);
        }}
      >
        <button
          type="button"
          className="guest-identity-button"
          aria-expanded={identityOpen}
          aria-controls="guest-identity-popover"
          aria-label={`Guest identity: ${identityLabel}`}
          onClick={() => {
            setOpen(false);
            setIdentityOpen((current) => !current);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
          </svg>
        </button>
        <div
          id="guest-identity-popover"
          className="guest-identity-popover"
          aria-hidden={!identityOpen}
        >
          <strong>Profile</strong>
          {guestName ? (
            <div className="guest-identity-row">
              <span>Name</span>
              <b>{guestName}</b>
            </div>
          ) : (
            <p>No guest name yet</p>
          )}
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
                  if (link.href === "/activity") setRideTab(null);
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
                rideTab === "driver"
                  ? "mobile-navigation-link active"
                  : "mobile-navigation-link"
              }
              onClick={() => startRide("driver")}
              aria-pressed={rideTab === "driver"}
              tabIndex={open ? undefined : -1}
            >
              Offer a ride
            </button>
            <button
              type="button"
              className={
                rideTab === "rider"
                  ? "mobile-navigation-link active"
                  : "mobile-navigation-link"
              }
              onClick={() => startRide("rider")}
              aria-pressed={rideTab === "rider"}
              tabIndex={open ? undefined : -1}
            >
              Find a ride
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

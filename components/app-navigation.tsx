"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AppNavigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const links = [
    { href: "/", label: "Home" },
    { href: "/activity", label: "Activity" },
  ];
  const goHome = () => {
    try {
      window.sessionStorage.setItem("cocowheels:show-home", "1");
    } catch {
      // A normal reload still provides safe guest-session recovery.
    }
    if (pathname === "/") {
      window.location.assign("/");
    } else {
      router.push("/");
    }
  };

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

  return (
    <>
      <nav aria-label="Primary navigation" className="desktop-navigation">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              (link.href === "/activity"
                ? pathname === "/activity" || pathname.startsWith("/activity/")
                : pathname === link.href)
                ? "desktop-navigation-link active"
                : "desktop-navigation-link"
            }
            aria-current={
              (link.href === "/activity"
                ? pathname === "/activity" || pathname.startsWith("/activity/")
                : pathname === link.href)
                ? "page"
                : undefined
            }
            onClick={(event) => {
              if (link.href === "/") {
                event.preventDefault();
                goHome();
              }
            }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        className="menu-toggle"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((current) => !current)}
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
                  (link.href === "/activity"
                    ? pathname === "/activity" || pathname.startsWith("/activity/")
                    : pathname === link.href)
                    ? "mobile-navigation-link active"
                    : "mobile-navigation-link"
                }
                aria-current={
                  (link.href === "/activity"
                    ? pathname === "/activity" || pathname.startsWith("/activity/")
                    : pathname === link.href)
                    ? "page"
                    : undefined
                }
                onClick={(event) => {
                  setOpen(false);
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
          </nav>
        </div>
      </div>
    </>
  );
}

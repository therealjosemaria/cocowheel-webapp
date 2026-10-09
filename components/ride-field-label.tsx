import type { ReactNode } from "react";

export type RideFieldIconKind =
  | "route"
  | "status"
  | "driver"
  | "rider"
  | "departure"
  | "from"
  | "to"
  | "expiry"
  | "accepted"
  | "requested"
  | "fit"
  | "price"
  | "payid"
  | "view"
  | "action"
  | "request-status";

export default function RideFieldLabel({
  icon,
  children,
}: {
  icon: RideFieldIconKind;
  children: ReactNode;
}) {
  return (
    <span className="ride-field-label">
      <RideFieldIcon icon={icon} />
      <span>{children}</span>
    </span>
  );
}

function RideFieldIcon({ icon }: { icon: RideFieldIconKind }) {
  let content: ReactNode = null;
  switch (icon) {
    case "route":
      content = (
        <>
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="18" r="2" />
          <path d="M8 6h3a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3" />
        </>
      );
      break;
    case "status":
      content = (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </>
      );
      break;
    case "driver":
      content = (
        <>
          <path d="M5 14.5h14l-1.5-4.3a2 2 0 0 0-1.9-1.4H8.4a2 2 0 0 0-1.9 1.4L5 14.5v3h2v-1h10v1h2v-3Z" />
          <path d="M7.5 14.5h.01M16.5 14.5h.01" />
        </>
      );
      break;
    case "rider":
      content = (
        <>
          <circle cx="12" cy="5" r="2" />
          <path d="M12 8.5v6m0-4-4 2.5m4-2.5 4 2.5m-4 1.5-3 5m3-5 3 5" />
        </>
      );
      break;
    case "departure":
      content = (
        <>
          <rect x="4" y="5.5" width="16" height="14" rx="2" />
          <path d="M8 3.5v4M16 3.5v4M4 9.5h16M8 13h3M8 16h6" />
        </>
      );
      break;
    case "from":
      content = <circle cx="12" cy="12" r="5" />;
      break;
    case "to":
      content = (
        <>
          <path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z" />
          <circle cx="12" cy="10" r="2" />
        </>
      );
      break;
    case "expiry":
      content = (
        <>
          <path d="M7 3h10M7 21h10M8 3c0 4 1 6 4 9-3 3-4 5-4 9M16 3c0 4-1 6-4 9 3 3 4 5 4 9" />
        </>
      );
      break;
    case "accepted":
      content = (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </>
      );
      break;
    case "requested":
      content = (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      );
      break;
    case "fit":
      content = (
        <>
          <path d="M5 18 10 13l3 3 6-8" />
          <path d="M15 8h4v4" />
        </>
      );
      break;
    case "price":
      content = (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M15 8.5c-.8-.7-1.8-1-3-1-1.7 0-3 .8-3 2s1 1.8 3 2.2 3 1 3 2.3-1.3 2.5-3 2.5c-1.2 0-2.4-.4-3.2-1.1M12 5.5v13" />
        </>
      );
      break;
    case "payid":
      content = (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 9h18M7 14h4" />
        </>
      );
      break;
    case "view":
      content = (
        <>
          <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      );
      break;
    case "action":
      content = <path d="m13 2-8 12h6l-1 8 9-13h-6V2Z" />;
      break;
    case "request-status":
      content = (
        <>
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h5" />
        </>
      );
      break;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {content}
    </svg>
  );
}

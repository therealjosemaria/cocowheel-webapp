import type { AlertSender } from "./usual-routes";

/** Shared bounded transport; callers supply a stable key for their persisted job. */
export const sendTransactionalEmail: AlertSender = async (email, key) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${process.env.COCOWHEELS_RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(email),
  });
  if (!response.ok) throw new Error("EMAIL_SEND_FAILED");
};
export function journeyEmailsConfigured() {
  return Boolean(process.env.COCOWHEELS_RESEND_API_KEY && process.env.COCOWHEELS_EMAIL_FROM && process.env.COCOWHEELS_PUBLIC_ORIGIN);
}

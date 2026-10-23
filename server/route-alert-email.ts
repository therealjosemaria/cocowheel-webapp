import { departureLabel } from "../lib/usual-route";
import { fareLabel } from "../lib/fare";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function routeAlertContent(origin: string, rideId: string, driver: string, departure: string, fare: number) {
  const base = origin.replace(/\/$/, "");
  const view = `${base}/?start=rider&match=${encodeURIComponent(rideId)}`;
  const mute = `${base}/usual-route?alerts=1`;
  const logo = `${base}/brand/gumwheel-original.png`;
  const heading = `A matching ride from ${driver}`;
  const timing = departureLabel(departure);
  const price = fareLabel(fare);
  const helper = "Coordinate pickup in messages.";
  return {
    text: `${heading}\n${timing}\n${price}\n${helper}\n\nView matching ride: ${view}\n\nMute matching emails: ${mute}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f8fafc;color:#111827;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 16px">
<table role="presentation" style="width:100%;max-width:560px;margin:0 auto;border-collapse:collapse;background:#ffffff;border:1px solid #e2e8f0"><tr><td style="padding:24px">
<table role="presentation" style="border-collapse:collapse;margin:0 0 24px"><tr><td style="padding:0;font-size:16px;line-height:20px;font-weight:700;letter-spacing:1.28px;vertical-align:middle">GUMWHEEL</td><td style="padding:0 0 3px 6px;vertical-align:middle;font-size:0;line-height:0"><img src="${escapeHtml(logo)}" width="15" height="15" alt="" style="display:block;width:15px;height:15px;border:0"></td></tr></table>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;font-weight:600">${escapeHtml(heading)}</h1>
<p style="margin:0;font-size:16px;line-height:1.6">${escapeHtml(timing)}<br>${escapeHtml(price)}</p>
<p style="margin:16px 0 24px;font-size:14px;line-height:1.5;color:#64748b">${helper}</p>
<a href="${escapeHtml(view)}" style="display:inline-block;padding:14px 20px;background:#111827;color:#ffffff;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;line-height:1.4">View matching ride</a>
<p style="margin:24px 0 0;font-size:12px;line-height:1.5"><a href="${escapeHtml(mute)}" style="color:#64748b;text-decoration:underline">Mute matching emails</a></p>
</td></tr></table></td></tr></table></body></html>`,
  };
}

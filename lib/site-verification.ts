import type { Metadata } from "next";

/** Provider ownership tokens are public HTML metadata, never sign-in credentials. */
export function siteVerification(google?: string, bing?: string): Metadata["verification"] {
  const values = [google?.trim() ?? "", bing?.trim() ?? ""];
  if (values.some(value => value && !/^[A-Za-z0-9_-]{1,512}$/.test(value))) {
    throw new Error("Use only the verification token value, not a full meta tag or URL");
  }
  if (!values.some(Boolean)) return undefined;
  return {
    ...(values[0] ? { google: values[0] } : {}),
    ...(values[1] ? { other: { "msvalidate.01": values[1] } } : {}),
  };
}

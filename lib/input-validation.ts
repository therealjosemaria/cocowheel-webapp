export const SEARCH_MAX_LENGTH = 300;
export const SEARCH_MAX_WORDS = 30;
export const PAYID_MAX_LENGTH = { MOBILE: 20, EMAIL: 254, OTHER: 160 } as const;
const hasControls = (text: string) =>
  Array.from(text).some(
    (character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  );
const words = (text: string) =>
  text.trim().split(/\s+/u).filter(Boolean).length;

export function searchInputError(text: string): string | null {
  if (
    text.length > SEARCH_MAX_LENGTH ||
    words(text) > SEARCH_MAX_WORDS ||
    hasControls(text)
  )
    return "Use up to 30 words and 300 characters.";
  return null;
}

export function payIdInputError(
  value: string,
  type: "MOBILE" | "EMAIL" | "OTHER",
): string | null {
  const text = value.trim();
  if (!text) return null;
  if (value.length > PAYID_MAX_LENGTH[type] || hasControls(value))
    return "Your PayID is too long or contains unsupported characters.";
  if (type === "MOBILE") {
    const compact = text.replace(/[ ()-]/g, "");
    return /^(?:04\d{8}|\+614\d{8})$/.test(compact)
      ? null
      : "Enter a mobile number as 04xx xxx xxx or +61 4xx xxx xxx.";
  }
  if (type === "EMAIL") {
    const parts = text.split("@");
    return parts.length === 2 &&
      parts[0].length <= 64 &&
      !parts[0].startsWith(".") &&
      !parts[0].endsWith(".") &&
      !parts[0].includes("..") &&
      /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(
        text,
      )
      ? null
      : "Enter an email address such as name@example.com.";
  }
  if (/^[\d\s-]+$/.test(text))
    return text.replace(/[\s-]/g, "").length === 11
      ? null
      : "An ABN must contain 11 digits.";
  return words(text) <= 20
    ? null
    : "Use up to 20 words for an organisation identifier.";
}

export const USERNAME_ERROR = "Use 3–8 letters or numbers.";
export const PHOTO_ERROR = "Choose a JPG, PNG or WebP photo up to 10 MB.";
export const reservedUsernames = new Set([
  "admin",
  "support",
  "gumwheel",
  "official",
  "system",
  "moderator",
]);
export function validUsername(value: string) {
  return /^[a-z0-9]{3,8}$/.test(value);
}
export type PersonalDetails = {
  username: string;
  email: string;
  photoUrl: string | null;
};

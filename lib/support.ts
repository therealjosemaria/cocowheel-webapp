// Public contact number, supplied by the owner for the creator-support link.
// Australian 0452 340 432 becomes +61 452 340 432; wa.me uses digits only.
export const SUPPORT_LABEL = "Contact us on WhatsApp";
export function supportWhatsAppUrl(rideId: string) {
  return `https://wa.me/61452340432?text=${encodeURIComponent(
    `Hi José, I need help with my GUMWHEEL ride. Reference: ${rideId}`,
  )}`;
}

/** Zero is an explicitly free ride; existing paid fares are never reinterpreted. */
export function fareLabel(priceAud: number): string {
  return priceAud === 0
    ? "Free"
    : `A$${Number.isInteger(priceAud) ? priceAud : priceAud.toFixed(2)}`;
}

export function validFare(priceAud: number): boolean {
  return (
    Number.isFinite(priceAud) &&
    Math.abs(priceAud * 100 - Math.round(priceAud * 100)) < 1e-8 &&
    (priceAud === 0 || (priceAud >= 1 && priceAud <= 10_000))
  );
}

export const CONTRIBUTION_ERROR =
  "Enter an amount from $1 to $10,000, with up to two decimal places.";

/** Preserve an editable decimal draft without allowing unbounded or exponent input. */
export function validFareDraft(value: string): boolean {
  return (
    /^\d{0,5}(?:\.\d{0,2})?$/.test(value) &&
    (value === "" || value === "." || Number(value) <= 10000)
  );
}

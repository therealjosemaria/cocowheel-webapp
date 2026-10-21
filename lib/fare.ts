/** Zero is an explicitly free ride; existing paid fares are never reinterpreted. */
export function fareLabel(priceAud: number): string {
  return priceAud === 0 ? "Free" : `A$${priceAud}`;
}

export function validFare(priceAud: number): boolean {
  return (
    Number.isInteger(priceAud) &&
    (priceAud === 0 || (priceAud >= 5 && priceAud <= 10_000))
  );
}

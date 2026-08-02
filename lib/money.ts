/**
 * Money handling.
 *
 * PKR is the one currency the app speaks, hardcoded — a picker nobody asked
 * for would be a decision a person has to make before they can log a glass of
 * monetary water. Swapping the currency later is changing two constants here.
 *
 * Amounts travel as integer minor units (`amountCents`, paise), never floats —
 * floats are how money accumulates rounding errors. Input arrives as a decimal
 * string and is converted exactly once, at the action boundary.
 */

const FORMATTER = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
});

const COMPACT_FORMATTER = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

const WHOLE_FORMATTER = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "Rs 24,500.00" — the ledger, transaction rows and tooltips. */
export function formatMoney(amountCents: number): string {
  return FORMATTER.format(amountCents / 100);
}

/** "Rs 24,500" — no paise. Chips and headlines, where decimals are noise. */
export function formatMoneyCompact(amountCents: number): string {
  return COMPACT_FORMATTER.format(amountCents / 100);
}

/**
 * "Rs 24,500" in full notation — the big number on the balance panel, where a
 * compact "24.5k" would cheapen the one figure the page exists to answer.
 */
export function formatMoneyWhole(amountCents: number): string {
  return WHOLE_FORMATTER.format(amountCents / 100);
}

/** The largest single amount the ledger accepts: Rs 10,000,000. */
export const MAX_AMOUNT_CENTS = 1_000_000_000;

/**
 * "1250" / "1250.5" / "1250.50" -> minor units. Null on anything malformed.
 * The format is checked here, the range in the schema; the two together are
 * the only way money enters the database.
 */
export function parseMoneyToCents(value: string): number | null {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) return null;
  const [rupees, paise = ""] = value.split(".");
  const cents = Number(rupees) * 100 + Number(paise.padEnd(2, "0"));
  return Number.isFinite(cents) ? cents : null;
}

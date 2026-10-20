// Units and per-unit rates printed on a bill (kWh and the rate per kWh, litres, nights...).
// The reader copies them as printed; code does every multiplication.

export type Rated = { units: number | null; rate: number | null };

const SAME_RATE = 0.0001;

// A detail block priced at one rate (every item has units and the same rate) gives its Summary line that
// units and rate, so "units times rate" can be checked against the line, and a promised tariff compared.
// A block with several rates (slabs) or with unrated rows is left alone: no single rate describes it.
export function impliedRate(items: Rated[]): { units: number; rate: number } | null {
  if (items.length === 0) return null;
  const rated = items.filter((i): i is { units: number; rate: number } => i.units !== null && i.rate !== null && i.units > 0 && i.rate > 0);
  if (rated.length !== items.length) return null;
  if (rated.some((i) => Math.abs(i.rate - rated[0].rate) > SAME_RATE)) return null;
  return { units: rated.reduce((total, i) => total + i.units, 0), rate: rated[0].rate };
}

export function withImpliedRates<L extends Rated>(lines: L[], blocks: { summaryIndex: number | null; items: Rated[] }[]): L[] {
  const result = [...lines];
  for (const block of blocks) {
    if (block.summaryIndex === null || result[block.summaryIndex]?.rate !== null) continue;
    const implied = impliedRate(block.items);
    if (implied) result[block.summaryIndex] = { ...result[block.summaryIndex], ...implied };
  }
  return result;
}

// Form text for an optional number: null when left empty, undefined when it is not a valid number.
export function parseOptionalNumber(text: string): number | null | undefined {
  if (!text.trim()) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

import { describe, expect, it } from "vitest";
import { impliedRate, withImpliedRates } from "./rates";

describe("implied rate of a detail block", () => {
  it("is the shared rate and the total units", () => {
    expect(impliedRate([{ units: 100, rate: 7.5 }, { units: 50, rate: 7.5 }])).toEqual({ units: 150, rate: 7.5 });
  });

  it("is none for slabs with different rates", () => {
    expect(impliedRate([{ units: 100, rate: 4 }, { units: 50, rate: 6 }])).toBeNull();
  });

  it("is none when a row has no units or rate, or the block is empty", () => {
    expect(impliedRate([{ units: 100, rate: 7.5 }, { units: null, rate: null }])).toBeNull();
    expect(impliedRate([])).toBeNull();
  });
});

describe("giving Summary lines their block's rate", () => {
  const lines = [
    { label: "Energy", amount: 1125, units: null, rate: null },
    { label: "Fixed", amount: 100, units: null, rate: null },
  ];

  it("fills only the line the block explains", () => {
    const blocks = [{ summaryIndex: 0, items: [{ units: 150, rate: 7.5 }] }];
    expect(withImpliedRates(lines, blocks)).toEqual([{ ...lines[0], units: 150, rate: 7.5 }, lines[1]]);
  });

  it("keeps a rate the line already has", () => {
    const own = [{ label: "Energy", amount: 1125, units: 150, rate: 7.5 }];
    expect(withImpliedRates(own, [{ summaryIndex: 0, items: [{ units: 10, rate: 9 }] }])).toEqual(own);
  });
});

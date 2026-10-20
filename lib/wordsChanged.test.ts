import { describe, expect, it } from "vitest";
import { wordsChanged } from "./wordsChanged";

const draft = "Hello, the bill shows 76.35 but it should be 64.70. Thank you";

describe("wordsChanged", () => {
  it("is 0 when the text is sent as drafted, whatever the spacing", () => {
    expect(wordsChanged(draft, draft)).toBe(0);
    expect(wordsChanged(draft, "  Hello,  the bill shows 76.35 but it\nshould be 64.70.   Thank you ")).toBe(0);
  });

  it("counts a replaced word as one change", () => {
    expect(wordsChanged(draft, draft.replace("Hello,", "Hi,"))).toBe(1);
  });

  it("counts an added word and a removed word as one change each", () => {
    expect(wordsChanged(draft, `${draft} very much`)).toBe(2);
    expect(wordsChanged(draft, draft.replace("Thank you", "Thank"))).toBe(1);
  });

  it("counts every draft word when the sent text is empty, and every sent word when the draft is empty", () => {
    expect(wordsChanged("one two three", "")).toBe(3);
    expect(wordsChanged("", "one two")).toBe(2);
  });

  it("counts a fully rewritten message as the larger of the two lengths", () => {
    expect(wordsChanged("a b c", "x y z w")).toBe(4);
  });
});

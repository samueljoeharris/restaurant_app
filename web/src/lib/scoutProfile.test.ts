import { describe, expect, it } from "vitest";
import { parseKidsAges } from "./scoutProfile";

describe("parseKidsAges", () => {
  it.each([
    ["3", [3]],
    ["2, 5", [2, 5]],
    ["2.5", [3]],
    ["2.4, 5.7", [2, 6]],
    ["  3 ,  7 ", [3, 7]],
    ["", []],
  ])("parses %p into %p", (input, expected) => {
    const { ages, error } = parseKidsAges(input);
    expect(error).toBeNull();
    expect(ages).toEqual(expected);
  });

  it("rejects non-numeric values", () => {
    const { error } = parseKidsAges("2, abc");
    expect(error).toBe('Invalid age: "abc". Ages must be numbers, e.g. 2, 5 or 2.5.');
  });

  it("rejects out-of-range values", () => {
    const { error } = parseKidsAges("18");
    expect(error).toBe("Ages must be between 0 and 17.");
  });

  it("rejects too many ages", () => {
    const { error } = parseKidsAges("1,2,3,4,5,6,7,8,9");
    expect(error).toBe("At most 8 kids ages are allowed.");
  });
});

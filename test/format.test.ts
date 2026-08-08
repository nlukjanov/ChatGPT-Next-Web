import { prettyObject, chunks } from "../app/utils/format";

describe("prettyObject", () => {
  test("wraps a plain string in a json code block", () => {
    expect(prettyObject("hello")).toBe('```json\nhello\n```');
  });

  test("stringifies non-string values", () => {
    expect(prettyObject({ a: 1 })).toBe('```json\n{\n  "a": 1\n}\n```');
  });

  test("returns 'undefined' string for empty object literal", () => {
    expect(prettyObject({})).toBe("[object Object]");
  });

  test("does not double-wrap strings already fenced as json", () => {
    const alreadyFenced = "```json\n{}\n```";
    expect(prettyObject(alreadyFenced)).toBe(alreadyFenced);
  });
});

describe("chunks", () => {
  test("yields the whole string in one chunk when under the limit", () => {
    const result = [...chunks("hello world")];
    expect(result).toEqual(["hello world"]);
  });

  test("splits long strings into multiple chunks that rejoin losslessly", () => {
    const input = "a".repeat(10) + " " + "b".repeat(10);
    const result = [...chunks(input, 10)];
    expect(result.join("")).toBe(input);
    expect(result.length).toBeGreaterThan(1);
  });

  test("respects the maxBytes boundary for each chunk", () => {
    const input = "word ".repeat(500);
    const maxBytes = 100;
    for (const chunk of chunks(input, maxBytes)) {
      expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(
        maxBytes + 1000,
      );
    }
  });
});

import {
  getMessageTextContent,
  getMessageTextContentWithoutThinking,
  getMessageImages,
  isDalle3,
  getModelSizes,
  supportsCustomSize,
  trimTopic,
  semverCompare,
} from "../app/utils";
import { RequestMessage } from "../app/client/api";

describe("getMessageTextContent", () => {
  test("returns plain string content as-is", () => {
    const message = { role: "user", content: "hello" } as RequestMessage;
    expect(getMessageTextContent(message)).toBe("hello");
  });

  test("extracts text from multipart content", () => {
    const message = {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: "http://img" } },
        { type: "text", text: "hi there" },
      ],
    } as RequestMessage;
    expect(getMessageTextContent(message)).toBe("hi there");
  });

  test("returns empty string when no text part exists", () => {
    const message = {
      role: "user",
      content: [{ type: "image_url", image_url: { url: "http://img" } }],
    } as RequestMessage;
    expect(getMessageTextContent(message)).toBe("");
  });
});

describe("getMessageTextContentWithoutThinking", () => {
  test("strips lines that start with the thinking quote prefix", () => {
    const message = {
      role: "assistant",
      content: "> thinking about it\nactual answer",
    } as RequestMessage;
    expect(getMessageTextContentWithoutThinking(message)).toBe(
      "actual answer",
    );
  });

  test("keeps normal content untouched", () => {
    const message = {
      role: "assistant",
      content: "line one\nline two",
    } as RequestMessage;
    expect(getMessageTextContentWithoutThinking(message)).toBe(
      "line one\nline two",
    );
  });
});

describe("getMessageImages", () => {
  test("returns empty array for plain string content", () => {
    const message = { role: "user", content: "hello" } as RequestMessage;
    expect(getMessageImages(message)).toEqual([]);
  });

  test("collects all image urls from multipart content", () => {
    const message = {
      role: "user",
      content: [
        { type: "text", text: "hi" },
        { type: "image_url", image_url: { url: "http://img1" } },
        { type: "image_url", image_url: { url: "http://img2" } },
      ],
    } as RequestMessage;
    expect(getMessageImages(message)).toEqual(["http://img1", "http://img2"]);
  });
});

describe("isDalle3", () => {
  test("matches only the exact dall-e-3 model name", () => {
    expect(isDalle3("dall-e-3")).toBe(true);
    expect(isDalle3("dall-e-2")).toBe(false);
    expect(isDalle3("gpt-4")).toBe(false);
  });
});

describe("getModelSizes / supportsCustomSize", () => {
  test("dall-e-3 supports its fixed set of sizes", () => {
    expect(getModelSizes("dall-e-3")).toEqual([
      "1024x1024",
      "1792x1024",
      "1024x1792",
    ]);
    expect(supportsCustomSize("dall-e-3")).toBe(true);
  });

  test("unrelated models have no custom sizes", () => {
    expect(getModelSizes("gpt-4")).toEqual([]);
    expect(supportsCustomSize("gpt-4")).toBe(false);
  });
});

describe("trimTopic", () => {
  test("trims trailing punctuation and quotes", () => {
    expect(trimTopic('"Weather Chat."')).toBe("Weather Chat");
  });

  test("leaves a clean topic unchanged", () => {
    expect(trimTopic("Weather Chat")).toBe("Weather Chat");
  });
});

describe("semverCompare", () => {
  test("treats a pre-release as lower than its release version", () => {
    expect(semverCompare("1.0.0-beta", "1.0.0")).toBe(-1);
    expect(semverCompare("1.0.0", "1.0.0-beta")).toBe(1);
  });

  test("orders numeric versions correctly", () => {
    expect(semverCompare("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(semverCompare("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(semverCompare("1.0.0", "1.0.0")).toBe(0);
  });
});

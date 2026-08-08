// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import { jest } from "@jest/globals";
import { TextDecoder, TextEncoder } from "util";

// jsdom doesn't provide these globals; app/utils/format.ts (chunked
// streaming) needs them.
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;
}
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder;
}

global.fetch = jest.fn((url?: any) =>
  Promise.resolve({
    ok: true,
    status: 200,
    // the prompt store fetches prompts.json during rehydration and
    // expects language keys; everything else gets an empty array
    json: () =>
      Promise.resolve(
        String(url).includes("prompts.json") ? { en: [], cn: [], tw: [] } : [],
      ),
    headers: new Headers(),
    redirected: false,
    statusText: "OK",
    type: "basic",
    url: "",
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(""),
  } as Response),
);

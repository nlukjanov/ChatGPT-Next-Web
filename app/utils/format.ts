export function prettyObject(msg: any) {
  const obj = msg;
  if (typeof msg !== "string") {
    msg = JSON.stringify(msg, null, "  ");
  }
  if (msg === "{}") {
    return obj.toString();
  }
  if (msg.startsWith("```json")) {
    return msg;
  }
  return ["```json", msg, "```"].join("\n");
}

export function* chunks(s: string, maxBytes = 900 * 1000) {
  const decoder = new TextDecoder("utf-8");
  let buf = new TextEncoder().encode(s);
  while (buf.length) {
    if (buf.length <= maxBytes) {
      yield decoder.decode(buf);
      break;
    }
    let i = buf.lastIndexOf(32, maxBytes + 1);
    if (i < 0) {
      // Cap forward search to avoid producing chunks larger than maxBytes
      const fwd = buf.indexOf(32, maxBytes);
      i = fwd >= 0 && fwd <= maxBytes + 1000 ? fwd : -1;
    }
    if (i >= 0) {
      // Include the space so reassembly with join("") is lossless
      yield decoder.decode(buf.slice(0, i + 1));
      buf = buf.slice(i + 1);
    } else {
      // Hard cut — scan back to UTF-8 character boundary
      let cut = maxBytes;
      while (cut > 0 && (buf[cut] & 0xc0) === 0x80) cut--;
      yield decoder.decode(buf.slice(0, cut));
      buf = buf.slice(cut);
    }
  }
}

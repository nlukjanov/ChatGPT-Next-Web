import { NextRequest, NextResponse } from "next/server";

async function handle(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const endpoint = requestUrl.searchParams.get("endpoint");

  if (!endpoint || !new URL(endpoint).hostname.endsWith(".upstash.io")) {
    return NextResponse.json(
      { error: true, msg: "forbidden" },
      { status: 403 },
    );
  }

  const body = await req.text();
  const res = await fetch(`${endpoint}/pipeline`, {
    method: "POST",
    headers: {
      authorization: req.headers.get("authorization") ?? "",
      "content-type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: true, msg: `upstream error ${res.status}: ${text}` },
      { status: res.status },
    );
  }

  return NextResponse.json(await res.json());
}

export const POST = handle;
export const runtime = "nodejs";

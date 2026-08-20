import type { NextResponse } from "next/server";

const requestIdPattern = /^[A-Za-z0-9._:-]{8,80}$/;

export function resolveRequestId(incoming?: string | null) {
  const candidate = incoming?.trim();

  if (candidate && requestIdPattern.test(candidate)) {
    return candidate;
  }

  return crypto.randomUUID();
}

export function createForwardedRequestHeaders(headers: Headers, requestId: string) {
  const forwarded = new Headers(headers);
  forwarded.set("x-request-id", requestId);
  return forwarded;
}

export function attachRequestId<T extends NextResponse>(response: T, requestId: string): T {
  response.headers.set("x-request-id", requestId);
  return response;
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import { submitPublicIntakeRequest, type PublicIntakeInput, type PublicIntakeLocale } from "@/app/actions/public/intake";

/**
 * Preserve a submission UUID across lost responses and retries.
 * Changing form data creates a new attempt, and a confirmed success resets it.
 * The server verifies that the UUID belongs to the exact request fingerprint.
 */
export function usePublicIntakeRetry() {
  const pending = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const formStartedAt = useRef<number | null>(null);
  useEffect(() => {
    formStartedAt.current = Date.now();
  }, []);

  return useCallback(async (input: PublicIntakeInput) => {
    const browserLocale = document.documentElement.lang;
    const locale: PublicIntakeLocale = browserLocale === "ky" || browserLocale === "en" ? browserLocale : "ru";
    const submitted = { ...input, locale, honeypot: input.honeypot ?? "", formStartedAt: formStartedAt.current ?? 0 };
    const fingerprint = JSON.stringify(submitted);
    if (!pending.current || pending.current.fingerprint !== fingerprint) {
      pending.current = { fingerprint, requestId: crypto.randomUUID() };
    }

    const result = await submitPublicIntakeRequest({
      ...submitted,
      requestId: pending.current.requestId
    });

    if (result.ok) pending.current = null;
    return result;
  }, []);
}

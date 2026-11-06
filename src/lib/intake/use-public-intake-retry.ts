"use client";

import { useCallback, useRef } from "react";
import { submitPublicIntakeRequest, type PublicIntakeInput } from "@/app/actions/public/intake";

/**
 * Preserve a submission UUID across lost responses and retries.
 * Changing form data creates a new attempt, and a confirmed success resets it.
 * The server verifies that the UUID belongs to the exact request fingerprint.
 */
export function usePublicIntakeRetry() {
  const pending = useRef<{ fingerprint: string; requestId: string } | null>(null);

  return useCallback(async (input: PublicIntakeInput) => {
    const fingerprint = JSON.stringify(input);
    if (!pending.current || pending.current.fingerprint !== fingerprint) {
      pending.current = { fingerprint, requestId: crypto.randomUUID() };
    }

    const result = await submitPublicIntakeRequest({
      ...input,
      requestId: pending.current.requestId
    });

    if (result.ok) pending.current = null;
    return result;
  }, []);
}

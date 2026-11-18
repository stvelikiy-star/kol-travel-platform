"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  issuePublicIntakeFormProof, submitPublicIntakeRequest, type PublicIntakeInput
} from "@/app/actions/public/intake";

/**
 * Form proof issued at mount, not just before submit: min-fill time is
 * verified by HMAC on the server. Preserve request UUID on network retries.
 */
export function usePublicIntakeRetry() {
  const pending = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const proof = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void issuePublicIntakeFormProof()
      .then((token) => { if (active) proof.current = token; })
      .catch(() => { if (active) proof.current = null; });
    return () => { active = false; };
  }, []);

  return useCallback(async (input: PublicIntakeInput) => {
    const fingerprint = JSON.stringify(input);
    if (!pending.current || pending.current.fingerprint !== fingerprint) {
      pending.current = { fingerprint, requestId: crypto.randomUUID() };
    }

    const result = await submitPublicIntakeRequest({
      ...input,
      antiBot: { proof: proof.current ?? "", honeypot: input.antiBot?.honeypot ?? "" },
      requestId: pending.current.requestId
    });

    if (result.ok) pending.current = null;
    return result;
  }, []);
}

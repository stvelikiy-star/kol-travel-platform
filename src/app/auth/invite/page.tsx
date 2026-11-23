"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const landing = new Set(["/admin", "/partner", "/courier", "/editor/content"]);

export default function StaffInvitePage() {
  const [result, setResult] = useState<"processing" | "failed">("processing");

  useEffect(() => {
    let canceled = false;
    const run = async () => {
      try {
        const client = getSupabaseBrowserClient();
        if (!client) throw new Error("Auth unavailable");
        const url = new URL(window.location.href);
        const dest = url.searchParams.get("next") || "/login";
        const next = landing.has(dest) ? dest : "/login";
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
        // Remove one-time credentials from the address bar immediately.
        window.history.replaceState(null, "", url.pathname + "?next=" + encodeURIComponent(next));
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type === "invite") {
          const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
          if (error) throw error;
        } else if (fragment.get("access_token") && fragment.get("refresh_token")) {
          const { error } = await client.auth.setSession({
            access_token: fragment.get("access_token")!,
            refresh_token: fragment.get("refresh_token")!
          });
          if (error) throw error;
        } else {
          // Browser auth may already have exchanged the supplied link.
          const { data: { user }, error } = await client.auth.getUser();
          if (error || !user) throw new Error("Invite link not verified");
        }
        // First-time staff need a durable password for subsequent team sign-ins.
        // They can reach their assigned workspace from /team after setting it.
        if (!canceled) window.location.replace("/account/security?staff_invite=1");
      } catch {
        if (!canceled) setResult("failed");
      }
    };
    void run();
    return () => { canceled = true; };
  }, []);

  return <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 className="text-2xl font-semibold">Приглашение в KÖL</h1>
    {result === "processing"
      ? <p role="status">Проверяем вашу ссылку приглашения…</p>
      : <>
        <p role="alert">Приглашение не подтверждено. Ссылка могла устареть или уже использоваться.</p>
        <Link className="font-semibold underline" href="/login">Вернуться к входу</Link>
      </>}
  </main>;
}

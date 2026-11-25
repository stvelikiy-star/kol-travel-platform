import Link from "next/link";
import { redirect } from "next/navigation";
import { MfaSetupClient } from "@/components/auth/MfaSetupClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeLoginNextPath } from "@/lib/auth/login-redirect";

export const dynamic = "force-dynamic";

export default async function MfaPage({searchParams}: {searchParams?: Promise<{next?:string}>}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?next=%2Faccount%2Fmfa");
  const {data: {user},error} = await supabase.auth.getUser();
  if (error || !user) redirect("/login?next=%2Faccount%2Fmfa");
  const params = await searchParams;
  const next = sanitizeLoginNextPath(params?.next ?? "/admin");
  return <main className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-cyan-950 px-4 py-12 text-white">
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-3">
        <p className="text-sm font-semibold tracking-widest text-cyan-300">KÖL · Безопасность</p>
        <h1 className="text-3xl font-bold">Двухфакторная аутентификация</h1>
        <p className="text-white/80">Защитите административную учётную запись с помощью одноразовых кодов из приложения-аутентификатора.</p>
      </header>
      <MfaSetupClient next={next} />
      <Link href="/account/security" className="inline-block text-sm underline underline-offset-4">Настройки аккаунта</Link>
    </div>
  </main>;
}

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Factor = { id: string; status?: string };
type Stage = "loading" | "enroll" | "verify" | "ready" | "error";

export function MfaSetupClient({ next }: { next: string }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [factor, setFactor] = useState<Factor | null>(null);
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const client = getSupabaseBrowserClient();
      if (!client) { if (active) setStage("error"); return; }
      const { data: userResult, error: userError } = await client.auth.getUser();
      if (!active) return;
      if (userError || !userResult.user) {
        setMessage("Сессия истекла. Войдите в аккаунт повторно.");
        setStage("error");
        return;
      }
      const [{ data: factors, error }, { data: assurance, error: aalError }] = await Promise.all([
        client.auth.mfa.listFactors(),
        client.auth.mfa.getAuthenticatorAssuranceLevel()
      ]);
      if (!active) return;
      if (error || aalError || !assurance) {
        setMessage("Не удалось проверить второй фактор. Обновите страницу.");
        setStage("error");
        return;
      }
      if (assurance.currentLevel === "aal2") { setStage("ready"); return; }
      const verified = factors?.totp?.find(f => f.status === "verified");
      if (verified) {
        setFactor({ id: verified.id, status: "verified" });
        setStage("verify");
      } else {
        setStage("enroll");
      }
    })().catch(() => { if (active) { setMessage("Сервис MFA недоступен."); setStage("error"); } });
    return () => { active = false; };
  }, []);

  async function enroll() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy(true); setMessage("");
    try {
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "KÖL Authenticator"
      });
      if (error || !data || !data.totp) throw new Error("enroll_failed");
      setFactor({ id: data.id });
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStage("verify");
    } catch {
      setMessage("Не удалось начать подключение. Попробуйте ещё раз или обратитесь к администратору.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    const client = getSupabaseBrowserClient();
    if (!client || !factor || !/^\d{6}$/.test(code)) {
      setMessage("Введите шесть цифр из приложения-аутентификатора.");
      return;
    }
    setBusy(true); setMessage("");
    try {
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) throw error;
      const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance?.currentLevel !== "aal2") throw new Error("aal2_missing");
      setSecret(""); setQr(""); setCode(""); setStage("ready");
      setMessage("Второй фактор подтверждён. Защищённая сессия активна.");
    } catch {
      setMessage("Код не подтверждён. Проверьте время и повторите попытку.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="space-y-4 rounded-2xl border border-white/20 bg-white/95 p-6 text-slate-950 shadow-xl" aria-label="Двухфакторная аутентификация">
    <h2 className="text-xl font-bold">Приложение-аутентификатор (TOTP)</h2>
    {stage === "loading" ? <p role="status">Проверяем безопасность аккаунта…</p> : null}
    {stage === "error" ? <p role="alert">{message}</p> : null}
    {stage === "enroll" ? <>
      <p>Подключите второй фактор перед доступом к административным операциям. Понадобится приложение, которое генерирует шестизначные коды.</p>
      <button type="button" onClick={enroll} disabled={busy} className="min-h-11 rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-60">
        {busy ? "Подключаем…" : "Подключить TOTP"}
      </button>
    </> : null}
    {stage === "verify" ? <>
      {qr ? <div className="space-y-3">
        <p>Отсканируйте QR-код приложением-аутентификатором. Не передавайте этот код другим людям.</p>
        <Image src={qr} alt="Персональный QR-код для настройки TOTP" width={216} height={216} unoptimized className="h-[216px] w-[216px]" />
        <details className="break-all rounded-md border p-3 text-xs">
          <summary className="cursor-pointer font-medium">Ввести секрет вручную</summary>
          <span className="mt-2 block font-mono select-all">{secret}</span>
        </details>
      </div> : <p>Откройте приложение-аутентификатор и введите текущий код для завершения входа.</p>}
      <form className="space-y-3" onSubmit={e => {e.preventDefault();void verify();}}>
        <label className="block text-sm font-medium" htmlFor="kol-mfa-code">Шестизначный код</label>
        <input id="kol-mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
          value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}
          className="block min-h-12 w-full max-w-xs rounded-md border border-slate-300 p-3" required />
        <button disabled={busy || code.length !== 6} className="min-h-11 rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-50">
          {busy ? "Проверяем…" : "Подтвердить код"}
        </button>
      </form>
    </> : null}
    {stage === "ready" ? <>
      <p role="status">Второй фактор успешно подтверждён для текущей сессии.</p>
      <a href={next} className="inline-block min-h-11 rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white">Продолжить в кабинет →</a>
    </> : null}
    {message && stage !== "error" && stage !== "ready" ? <p role="alert">{message}</p> : null}
    {stage !== "ready" ? <p className="text-xs text-slate-600">При потере устройства обратитесь к уполномоченному администратору. Самостоятельный обход второго фактора недоступен.</p> : null}
  </section>;
}

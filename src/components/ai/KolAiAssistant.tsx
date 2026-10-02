"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

const welcomeMessage: ChatMessage = {
  role: "assistant",
  text: "Салам! Я AI-помощник KÖL. Помогу подобрать направление, жильё, туры и объясню, как пользоваться платформой."
};

const quickPrompts = [
  "Помоги выбрать жильё",
  "Что можно сделать на Иссык-Куле?",
  "Как оформить заявку?"
];

export function KolAiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedSession = window.localStorage.getItem("kol_ai_session_id");
    if (storedSession) setSessionId(storedSession);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, loading]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;

    setMessages((current) => [...current, { role: "user", text: message }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/kol-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          sessionId
        })
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        sessionId?: string;
        reply?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.reply) {
        throw new Error(payload.message || "AI unavailable");
      }

      if (payload.sessionId) {
        setSessionId(payload.sessionId);
        window.localStorage.setItem("kol_ai_session_id", payload.sessionId);
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", text: payload.reply || "" }
      ]);
    } catch (error) {
      console.error(error);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Сейчас AI-помощник не отвечает. Можно продолжить пользоваться KÖL — поиск, карточки и заявки работают отдельно."
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  return (
    <>
      <button
        aria-label="Открыть AI-помощника KÖL"
        className="fixed bottom-5 right-5 z-[70] flex h-14 items-center gap-2 rounded-full border border-cyan-100 bg-slate-950 px-5 text-sm font-semibold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-cyan-200/50"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300 text-lg text-slate-950">
          ✦
        </span>
        <span className="hidden sm:inline">AI-помощник</span>
      </button>

      {open ? (
        <section
          aria-label="AI-помощник KÖL"
          className="fixed bottom-24 right-4 z-[70] flex h-[min(650px,calc(100vh-8rem))] w-[calc(100vw-2rem)] max-w-[420px] flex-col overflow-hidden rounded-[1.75rem] border border-cyan-100 bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-cyan-100 bg-slate-950 px-5 py-4 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                KÖL AI
              </p>
              <h2 className="mt-1 text-lg font-semibold">Помощник по поездке</h2>
            </div>
            <button
              aria-label="Закрыть AI-помощника"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl transition hover:bg-white/20"
              onClick={() => setOpen(false)}
              type="button"
            >
              ×
            </button>
          </header>

          <div
            className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4"
            ref={scrollRef}
          >
            {messages.map((message, index) => (
              <div
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[86%] rounded-2xl rounded-br-md bg-slate-950 px-4 py-3 text-sm leading-6 text-white"
                    : "max-w-[90%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm"
                }
                key={`${message.role}-${index}-${message.text.slice(0, 12)}`}
              >
                {message.text}
              </div>
            ))}

            {loading ? (
              <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                Думаю…
              </div>
            ) : null}
          </div>

          {messages.length === 1 ? (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-white px-4 pt-3">
              {quickPrompts.map((prompt) => (
                <button
                  className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-cyan-100"
                  key={prompt}
                  onClick={() => void send(prompt)}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <form className="border-t border-slate-200 bg-white p-4" onSubmit={submit}>
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100/70">
              <textarea
                aria-label="Сообщение AI-помощнику"
                className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-slate-900 outline-none placeholder:text-slate-400"
                maxLength={4000}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (input.trim()) void send(input);
                  }
                }}
                placeholder="Напишите, что вам нужно…"
                rows={1}
                value={input}
              />
              <button
                className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!input.trim() || loading}
                type="submit"
              >
                Отправить
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-slate-400">
              AI не подтверждает цену, наличие или бронь без данных KÖL.
            </p>
          </form>
        </section>
      ) : null}
    </>
  );
}

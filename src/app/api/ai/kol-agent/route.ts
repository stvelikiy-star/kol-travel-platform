import { NextRequest, NextResponse } from "next/server";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const AGENTS_BETA_HEADER = "agents=v1";
const DEFAULT_MODEL = process.env.KOL_AI_MODEL || "gpt-6-astra";
const SESSION_COOKIE = "kol_ai_bound_session";
const SESSION_ID_PATTERN = /^sess_[a-zA-Z0-9_-]{8,160}$/;
const MAX_MESSAGE_LENGTH = 1200;

const KOL_AGENT_INSTRUCTIONS = `
Ты официальный AI-помощник туристической платформы KÖL для Иссык-Куля.

Твоя задача:
- помогать пользователю подобрать жильё, туры, доставку, еду и другие услуги KÖL;
- объяснять, как пользоваться платформой;
- задавать только действительно нужные уточняющие вопросы;
- отвечать понятно, коротко и дружелюбно;
- по умолчанию отвечать на языке пользователя.

Критические правила:
- не выдумывай цены, наличие, подтверждение бронирования, статус оплаты, возврата или заказа;
- если у тебя нет live-данных KÖL, прямо скажи, что нужно открыть соответствующий раздел или выполнить поиск в системе;
- не обещай, что бронь/заказ создан, пока система явно не вернула подтверждение;
- не запрашивай лишние персональные данные;
- не выдавай внутренние данные партнёров, сотрудников или других пользователей;
- для финансовых, платёжных и спорных ситуаций предлагай обратиться в поддержку KÖL;
- не придумывай факты об отелях, турах и партнёрах, которых нет в доступном контексте.

Стиль:
- помогай как хороший локальный travel-консьерж;
- избегай технических терминов;
- предлагай следующий полезный шаг.
`.trim();

type AgentSession = {
  id?: string;
  status?: string;
  error?: unknown;
  required_actions?: unknown[];
};

function openAIHeaders() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");

  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "OpenAI-Beta": AGENTS_BETA_HEADER
  };
}

async function openAIFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${OPENAI_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...openAIHeaders(),
      ...(init?.headers || {})
    },
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    // Never log or propagate provider response bodies: they may contain private content.
    throw new Error(`OpenAI request failed (HTTP ${response.status})`);
  }

  if (response.status === 204 || response.status === 202) return null;
  return response.json();
}

function localeInstruction(locale: "ru" | "ky" | "en") {
  if (locale === "ky") return "Текущий язык интерфейса — кыргызский. Отвечай на кыргызском языке, если пользователь явно не попросил другой язык.";
  if (locale === "en") return "The current interface language is English. Reply in English unless the user explicitly asks for another language.";
  return "Текущий язык интерфейса — русский. Отвечай на русском языке, если пользователь явно не попросил другой язык.";
}

async function createSession(message: string, locale: "ru" | "ky" | "en"): Promise<AgentSession> {
  return openAIFetch("/agents/sessions", {
    method: "POST",
    body: JSON.stringify({
      agent: {
        name: "KOL Travel Assistant",
        model: DEFAULT_MODEL,
        instructions: `${KOL_AGENT_INSTRUCTIONS}\n\n${localeInstruction(locale)}`,
        reasoning: { effort: "low" }
      },
      environment: { type: "none" },
      input: message,
      stream: false,
      metadata: {
        product: "kol",
        channel: "web"
      }
    })
  });
}

async function sendMessage(sessionId: string, message: string) {
  await openAIFetch(`/agents/sessions/${encodeURIComponent(sessionId)}/events`, {
    method: "POST",
    headers: {
      "Idempotency-Key": crypto.randomUUID()
    },
    body: JSON.stringify({
      events: [
        {
          type: "agent.session.input.message",
          input: [
            {
              role: "user",
              content: [{ type: "input_text", text: message }]
            }
          ]
        }
      ]
    })
  });
}

async function waitForTurn(sessionId: string) {
  const startedAt = Date.now();
  const timeoutMs = 25_000;

  while (Date.now() - startedAt < timeoutMs) {
    const session = (await openAIFetch(
      `/agents/sessions/${encodeURIComponent(sessionId)}`
    )) as AgentSession;

    if (session.status === "failed") {
      throw new Error("AI session failed");
    }

    if (session.status === "requires_action") {
      throw new Error("AI session requires a tool action that is not connected yet");
    }

    if (session.status === "idle") return;

    await new Promise((resolve) => setTimeout(resolve, 450));
  }

  throw new Error("AI response timed out");
}

function extractAssistantText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const data = (payload as { data?: unknown[] }).data;
  if (!Array.isArray(data)) return null;

  for (let index = data.length - 1; index >= 0; index -= 1) {
    const item = data[index] as Record<string, unknown>;
    if (item.role !== "assistant" || !Array.isArray(item.content)) continue;

    const parts: string[] = [];

    for (const content of item.content) {
      if (!content || typeof content !== "object") continue;
      const part = content as Record<string, unknown>;

      if (typeof part.text === "string" && part.text.trim()) {
        parts.push(part.text.trim());
      }

      const nestedText = part.text;
      if (
        nestedText &&
        typeof nestedText === "object" &&
        typeof (nestedText as Record<string, unknown>).value === "string"
      ) {
        parts.push(String((nestedText as Record<string, unknown>).value).trim());
      }
    }

    if (parts.length) return parts.join("\n");
  }

  return null;
}

async function getLatestAssistantText(sessionId: string) {
  const payload = await openAIFetch(
    `/agents/sessions/${encodeURIComponent(sessionId)}/items?order=asc&limit=100`
  );

  return extractAssistantText(payload);
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.KOL_AI_AGENT_ENABLED !== "true") {
      return NextResponse.json(
        {
          ok: false,
          code: "ai_not_enabled",
          message: "KÖL AI пока не включён в окружении."
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as {
      message?: unknown;
      sessionId?: unknown;
      locale?: unknown;
    };

    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ ok: false, code: "message_too_long", message: "Сократите сообщение." }, { status: 413 });
    }
    if (!message) {
      return NextResponse.json(
        { ok: false, code: "invalid_message", message: "Введите сообщение." },
        { status: 400 }
      );
    }

    const locale: "ru" | "ky" | "en" =
      body.locale === "ky" || body.locale === "en" ? body.locale : "ru";

    const requestedSessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    const boundSessionId = request.cookies.get(SESSION_COOKIE)?.value;
    if (requestedSessionId && (
      !SESSION_ID_PATTERN.test(requestedSessionId) || requestedSessionId !== boundSessionId
    )) {
      return NextResponse.json({ ok: false, code: "session_forbidden", message: "Сессия не принадлежит этому браузеру." }, { status: 403 });
    }
    let sessionId = requestedSessionId;
    const isNewSession = !sessionId;

    if (!sessionId) {
      const session = await createSession(message, locale);
      sessionId = session.id || null;
      if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) throw new Error("OpenAI did not return a valid session id");
    } else {
      await sendMessage(sessionId, message);
    }

    await waitForTurn(sessionId);

    const reply = await getLatestAssistantText(sessionId);

    if (!reply) {
      throw new Error("AI returned no assistant text");
    }

    const response = NextResponse.json({ ok: true, sessionId, reply });
    if (isNewSession) {
      response.cookies.set(SESSION_COOKIE, sessionId, {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "strict", path: "/api/ai/kol-agent", maxAge: 60 * 60
      });
    }
    return response;
  } catch (error) {
    // Log error category only; never emit upstream payloads or session contents.
    console.error("KOL AI agent error", error instanceof Error ? error.name : "unknown");

    return NextResponse.json(
      {
        ok: false,
        code: "ai_unavailable",
        message:
          "AI-помощник временно недоступен. Попробуйте ещё раз немного позже."
      },
      { status: 502 }
    );
  }
}

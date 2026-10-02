# KÖL AI Agent v1

Первая интеграция OpenAI Agents API в KÖL.

## Что сделано

- плавающий AI-помощник в публичном интерфейсе;
- server-only endpoint `/api/ai/kol-agent`;
- долговечная Agents API session хранится в браузере как session ID;
- OpenAI API key не попадает в клиент;
- fail-closed флаг `KOL_AI_AGENT_ENABLED`;
- агенту запрещено выдумывать цены, наличие, брони и оплату;
- если AI недоступен, основной KÖL продолжает работать.

## Переменные окружения

```
KOL_AI_AGENT_ENABLED=true
OPENAI_API_KEY=...
KOL_AI_MODEL=gpt-6-astra
```

Для application API key нужны права Agents API и Responses inference.

## Граница v1

Это консультационный AI-помощник. Он пока не получает прямые live-tools к каталогу, доступности, заявкам или бронированию.

Следующий этап: добавить только server-side read-only tools KÖL, затем отдельно разрешённые write-actions с audit log и подтверждениями.

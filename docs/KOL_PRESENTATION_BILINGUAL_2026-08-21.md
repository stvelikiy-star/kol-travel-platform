# KÖL — bilingual presentation state — 2026-08-21

## Presentation language

The presentation surface is bilingual:
- Russian (RU)
- Kyrgyz (KG)

The language switch is client-side and updates the complete presentation surface without reloading the page.

## Visual presentation layer

The presentation page uses thematic Kyrgyzstan imagery for:
- Issyk-Kul hero
- KÖL Stay / Kyrgyz yurt
- KÖL Tours / horse riding
- KÖL Food / beshbarmak
- KÖL Shop / Kyrgyz felt products

Sources are Wikimedia Commons file paths and are attributed in the presentation footer.

## Interactive demonstration

The presentation supports:
- service switching: Stay / Tours / Food / Shop
- date and guest / participant fields for booking scenarios
- cart increment for Food and Shop
- Client / Partner / Courier / Admin role switching
- RU / KG switching
- responsive desktop/mobile layout

This is a presentation interaction layer only. It does not activate payments and does not mutate live Supabase.

## Source proof

Exact source head after bilingual presentation update:
`2c13b2f18c8fcf491c1efbfa45fb8187a55ff6c6`

KÖL CI run `32452341738`: PASS.

## Standalone Vercel preview

Project: `kol-presentation-20260821`
Deployment: `dpl_HBjK2Wyun5cEJFhCbzftxuuDy4Ko`
Host: `kol-presentation-20260821-h3uc5aw5o-ai-prof-kg.vercel.app`

The standalone preview is preview-only and does not authorize production release.
# Public Catalog Read Pilot Plan

Stage: 12K-2 - Public Catalog Read Pilot Plan.

This plan defines the first safe future Supabase read pilot for public catalog data only. Do not connect Supabase yet, do not switch `DATA_SOURCE_MODE` to `supabase`, and do not add real writes.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Plan the first safe Supabase read pilot.
- Start only with public catalog data.
- Avoid auth/role complexity at first.
- Keep mock fallback.
- No writes yet.
- Keep the app building without real Supabase env values in mock mode.

## 2. Why Public Catalog First

- Low risk.
- Public data only.
- No payment.
- No cancellation.
- No user private data.
- Easy to compare mock vs Supabase output.
- Easier rollback through `DATA_SOURCE_MODE=mock`.

## 3. Public Pages In Scope

Future read pilot pages:

- `/tours`
- `/stays`
- `/food`
- `/shop`
- `/partners`
- `/tours/[slug]`
- `/stays/[slug]`
- `/food/[restaurantSlug]`
- `/shop/[shopSlug]`

## 4. Data Groups To Validate

Validate public catalog data for:

- tours;
- stays;
- food items/restaurants;
- products/shops;
- partners;
- public offers if present;
- images/placeholders;
- prices;
- ratings;
- categories;
- locations.

## 5. Future Adapter Functions To Validate

Likely data layer functions from `src/lib/data`:

- `getTours`
- `getTourBySlug`
- `getStays`
- `getStayBySlug`
- `getFood`
- `getRestaurantBySlug`
- `getProducts`
- `getShopBySlug`
- `getPartners`
- `getPartnerById` or `getPartnerBySlug` if exists

Actual function names must be verified in `src/lib/data` before implementation.

## 6. Validation Checklist

For each catalog page:

- Page renders from mock mode first.
- Supabase test data exists.
- Adapter can read corresponding table later.
- Empty state works.
- Missing image fallback works.
- Missing price fallback works.
- Invalid slug returns safe not-found.
- No private data is exposed.
- No service role key is used in client.
- Page still builds without real env in mock mode.
- UI pages keep using data layer helpers rather than direct Supabase imports.

## 7. Mock Vs Supabase Comparison

Compare these fields:

- `id`
- `slug`
- `title`/`name`
- `category`/`type`
- `location`
- `price`
- `rating`
- `image`
- `description`
- `availability`/`status`
- partner reference

Differences should be documented before expanding the pilot beyond the first page.

## 8. Safety

- Keep `DATA_SOURCE_MODE=mock` until read pilot is ready.
- Do not remove mock data.
- Do not remove demo actions.
- Do not connect write actions.
- Do not expose service role key.
- Do not show raw Supabase errors to users.
- Rollback is `DATA_SOURCE_MODE=mock`.
- Do not connect payments.
- Do not connect Telegram or n8n.

## 9. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Public catalog must not show alcohol products or alcohol delivery.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Future activation requires legal review, licensing, partner verification and `super_admin` approval.
- Alcohol-related request is critical risk.

## 10. Recommended Implementation Order Later

1. Verify existing data layer functions.
2. Verify Supabase table names.
3. Add safe adapter mapping.
4. Test one page only, starting with `/tours`.
5. Compare mock vs Supabase.
6. Add empty/error fallback.
7. Expand to stays, food, shop and partners.
8. Keep build passing.

## 11. Next Stages

Recommended next stages:

1. `12K-3 Internal Read Validation Plan`
2. `12K-4 Read Adapter Rollback Plan`
3. `12L-1 First Real Write Pilot Plan`

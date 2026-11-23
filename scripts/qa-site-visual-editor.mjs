import fs from "node:fs";

const files = {
  upload: fs.readFileSync("src/app/actions/admin/siteVisuals.ts", "utf8"),
  read: fs.readFileSync("src/lib/data/home-visuals-read.ts", "utf8"),
  editor: fs.readFileSync("src/app/admin/content/page.tsx", "utf8"),
  home: fs.readFileSync("src/app/page.tsx", "utf8"),
  migration: fs.readFileSync("ops/release-sql/kol-site-visuals-storage-20261123.sql", "utf8"),
  config: fs.readFileSync("next.config.ts", "utf8")
};
const must = (file, text) => {
  if (!files[file].includes(text)) {
    console.error("KÖL site visual QA FAIL: " + file + " lacks " + text);
    process.exitCode = 1;
  }
};
for (const text of [
  'requireRole(["super_admin", "content_manager"])',
  'file.size > maxBytes', 'file.type !== verified.mime',
  'upsert: false', 'saveSiteContent(draft)', 'content_key'
]) must("upload", text);
for (const text of [
  'getPublishedSiteText("home.visual.background"',
  'getPublishedSiteText("home.visual.banner"',
  'getPublishedSiteText("home.visual.banner_link"',
  'url.protocol !== "https:"', 'url.origin !== base.origin',
  'url.username', 'url.password', 'safeSiteBannerLink'
]) must("read", text);
for (const text of [
  'uploadSiteVisual(data)', 'saveSiteContent(draft)',
  'publishSiteContent(data)', 'safeSiteVisualUrl(candidate.value)',
  'name="file"', 'name="kind"', 'Опубликовать изображение'
]) must("editor", text);
for (const text of [
  'getHomeVisuals()', 'homeVisuals.background', 'homeVisuals.banner',
  'homeVisuals.bannerLink'
]) must("home", text);
for (const text of [
  "public, file_size_limit", "private.can_manage_content()",
  "FOR INSERT TO authenticated", "bucket_id='site-visuals'"
]) must("migration", text);
must("config", 'bodySizeLimit: "4.4mb"');
if (files.upload.includes("createSupabaseServiceRoleClient") || files.migration.includes("TO anon\n WITH CHECK")) {
  console.error("KÖL site visual QA FAIL: image upload must not bypass user-scoped RLS");
  process.exitCode = 1;
}
if (!process.exitCode) console.log("KÖL site visual editor source QA: PASS (upload, publish, homepage, role gate, storage policy).");

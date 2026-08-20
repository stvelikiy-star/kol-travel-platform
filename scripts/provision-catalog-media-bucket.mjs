import { createClient } from "@supabase/supabase-js";

const BUCKET_ID = "catalog-media";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function fail(message) {
  console.error(`[catalog-media] ${message}`);
  process.exitCode = 1;
}

function readEnv() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const deploymentEnv = process.env.KOL_DEPLOYMENT_ENV || process.env.VERCEL_ENV || "unknown";

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  return { url, serviceRoleKey, deploymentEnv };
}

function normalizeMimeTypes(bucket) {
  const value = bucket?.allowed_mime_types ?? bucket?.allowedMimeTypes ?? [];
  return Array.isArray(value) ? value.map(String).sort() : [];
}

function normalizeLimit(bucket) {
  const value = bucket?.file_size_limit ?? bucket?.fileSizeLimit ?? 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bucketMatchesContract(bucket) {
  if (!bucket) return false;

  const actualMime = normalizeMimeTypes(bucket);
  const expectedMime = [...ALLOWED_MIME_TYPES].sort();

  return (
    bucket.id === BUCKET_ID &&
    bucket.name === BUCKET_ID &&
    bucket.public === false &&
    normalizeLimit(bucket) === MAX_BYTES &&
    JSON.stringify(actualMime) === JSON.stringify(expectedMime)
  );
}

async function readBucket(supabase) {
  const { data, error } = await supabase.storage.listBuckets({
    limit: 100,
    offset: 0,
    search: BUCKET_ID
  });

  if (error) throw new Error(`Bucket list failed: ${error.message}`);
  return Array.isArray(data) ? data.find((bucket) => bucket.id === BUCKET_ID) ?? null : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { url, serviceRoleKey, deploymentEnv } = readEnv();

  if (apply && deploymentEnv === "production") {
    throw new Error(
      "This helper refuses production Storage provisioning. Production requires a separate owner-approved release action."
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  const existingBucket = await readBucket(supabase);

  if (!apply) {
    if (!existingBucket) {
      fail("bucket is missing; run with --apply only in an approved non-production staging environment.");
      return;
    }

    if (!bucketMatchesContract(existingBucket)) {
      fail("bucket exists but does not match the required private 8 MiB image-only contract.");
      return;
    }

    console.log("[catalog-media] bucket contract PASS (read-only check). No Storage mutation performed.");
    return;
  }

  const options = {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ALLOWED_MIME_TYPES
  };

  if (existingBucket) {
    const { error } = await supabase.storage.updateBucket(BUCKET_ID, options);
    if (error) throw new Error(`Bucket update failed: ${error.message}`);
  } else {
    const { error } = await supabase.storage.createBucket(BUCKET_ID, options);
    if (error) throw new Error(`Bucket create failed: ${error.message}`);
  }

  const verifiedBucket = await readBucket(supabase);
  if (!bucketMatchesContract(verifiedBucket)) {
    throw new Error("Bucket verification failed after Storage API provisioning.");
  }

  console.log("[catalog-media] bucket contract PASS after Storage API provisioning.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Unknown catalog-media provisioning error.");
});

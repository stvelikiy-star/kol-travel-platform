export function isShowcasePreview() {
  return (
    process.env.KOL_PUBLIC_INTAKE_LAUNCH_MODE !== "true" &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.KOL_DEPLOYMENT_ENV !== "production"
  );
}

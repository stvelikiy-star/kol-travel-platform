export type DataSourceMode = "mock" | "supabase";

const DEFAULT_DATA_SOURCE_MODE: DataSourceMode = "mock";
const DATA_SOURCE_LABELS: Record<DataSourceMode, string> = {
  mock: "Mock data mode",
  supabase: "Supabase mode prepared, real adapters not connected yet"
};

function normalizeDataSourceMode(value?: string): DataSourceMode {
  if (value === "supabase") {
    return "supabase";
  }

  return DEFAULT_DATA_SOURCE_MODE;
}

export function getDataSourceMode(): DataSourceMode {
  return normalizeDataSourceMode(process.env.DATA_SOURCE_MODE);
}

export function isMockDataMode() {
  return getDataSourceMode() === "mock";
}

export function isSupabaseMode() {
  return getDataSourceMode() === "supabase";
}

export function assertMockMode() {
  return isMockDataMode();
}

export function getSafeDataSourceLabel() {
  return DATA_SOURCE_LABELS[getDataSourceMode()];
}

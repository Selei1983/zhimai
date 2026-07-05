import { createClient } from "@insforge/sdk";

export function createInsForgeClient(accessToken?: string) {
  const baseUrl = process.env.INSFORGE_BASE_URL;
  const anonKey = process.env.INSFORGE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new Error("InsForge 配置缺失，请检查 INSFORGE_BASE_URL 和 INSFORGE_ANON_KEY");
  }

  return createClient({ baseUrl, anonKey, accessToken });
}

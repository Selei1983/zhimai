"use client";

import { createClient } from "@insforge/sdk";

export function createInsForgeBrowserClient(accessToken?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new Error("InsForge 浏览器配置缺失");
  }

  return createClient({
    baseUrl,
    anonKey,
    accessToken,
    isServerMode: false,
  });
}

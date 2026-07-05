import "server-only";
import { defaultGenerationPrompt } from "@/lib/ai/defaults";
import { decryptApiKey, encryptApiKey, keyHint } from "@/lib/ai/secret";
import { createInsForgeClient } from "@/lib/insforge/client";
import { getInsForgeErrorMessage } from "@/lib/insforge/mappers";
import type { AiProviderConfig } from "@/lib/zhimai-data";

export type AiProviderInput = {
  provider: AiProviderConfig["provider"];
  baseUrl: string;
  model: string;
  generationPrompt?: string;
  apiKey?: string;
  isEnabled: boolean;
};

export type AiProviderTestResult = {
  ok: boolean;
  message: string;
  latencyMs?: number;
};

export type AiProviderRuntimeConfig = {
  baseUrl: string;
  model: string;
  generationPrompt: string;
  apiKey: string;
  isEnabled: boolean;
};

type AiProviderRow = {
  id: string;
  provider: AiProviderConfig["provider"];
  base_url: string;
  model: string;
  generation_prompt?: string | null;
  api_key_ciphertext?: string | null;
  key_hint: string;
  is_enabled: boolean;
  updated_at: string;
};

const configSelect = "id,provider,base_url,model,generation_prompt,key_hint,is_enabled,updated_at";
const legacyConfigSelect = "id,provider,base_url,model,key_hint,is_enabled,updated_at";

function getConfigId(workspaceId: string) {
  return `ai-config-${workspaceId}`;
}

export async function getAiProviderConfig(workspaceId: string, accessToken?: string): Promise<AiProviderConfig | null> {
  const client = createInsForgeClient(accessToken);
  const configId = getConfigId(workspaceId);
  const result = await client.database
    .from("ai_provider_configs")
    .select(configSelect)
    .eq("id", configId)
    .maybeSingle();

  if (result.error && getInsForgeErrorMessage(result.error).includes("generation_prompt")) {
    const legacyResult = await client.database
      .from("ai_provider_configs")
      .select(legacyConfigSelect)
      .eq("id", configId)
      .maybeSingle();

    if (legacyResult.error) {
      throw new Error(`读取 AI 配置失败: ${getInsForgeErrorMessage(legacyResult.error)}`);
    }

    if (!legacyResult.data) return null;
    return toAiProviderConfig(legacyResult.data as AiProviderRow);
  }

  if (result.error) {
    throw new Error(`读取 AI 配置失败: ${getInsForgeErrorMessage(result.error)}`);
  }

  if (!result.data) return null;
  return toAiProviderConfig(result.data as AiProviderRow);
}

export async function saveAiProviderConfig(
  input: AiProviderInput,
  workspaceId: string,
  accessToken?: string,
): Promise<AiProviderConfig> {
  const client = createInsForgeClient(accessToken);
  const configId = getConfigId(workspaceId);
  const normalized = normalizeInput(input);
  const existing = await client.database
    .from("ai_provider_configs")
    .select("id,api_key_ciphertext,key_hint")
    .eq("id", configId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`读取已有 AI 配置失败: ${getInsForgeErrorMessage(existing.error)}`);
  }

  const existingRow = existing.data as Pick<AiProviderRow, "api_key_ciphertext" | "key_hint"> | null;
  const cleanApiKey = input.apiKey?.trim();

  if (!cleanApiKey && !existingRow?.api_key_ciphertext) {
    throw new Error("首次配置 AI 时需要填写 API Key");
  }

  const keyFields = cleanApiKey
    ? {
        api_key_ciphertext: encryptApiKey(cleanApiKey),
        key_hint: keyHint(cleanApiKey),
      }
    : {
        api_key_ciphertext: existingRow?.api_key_ciphertext,
        key_hint: existingRow?.key_hint ?? "已配置",
      };

  const payload = {
    id: configId,
    workspace_id: workspaceId,
    provider: normalized.provider,
    base_url: normalized.baseUrl,
    model: normalized.model,
    generation_prompt: normalized.generationPrompt,
    is_enabled: normalized.isEnabled,
    updated_at: new Date().toISOString(),
    ...keyFields,
  };

  const result = existing.data
    ? await client.database
        .from("ai_provider_configs")
        .update(payload)
        .eq("id", configId)
        .select(configSelect)
        .single()
    : await client.database
        .from("ai_provider_configs")
        .insert(payload)
        .select(configSelect)
        .single();

  if (result.error) {
    if (getInsForgeErrorMessage(result.error).includes("generation_prompt")) {
      throw new Error("远端数据库缺少 generation_prompt 字段，请先执行 apps/web/insforge/ai-config.sql 中的迁移");
    }
    throw new Error(`保存 AI 配置失败: ${getInsForgeErrorMessage(result.error)}`);
  }

  return toAiProviderConfig(result.data as AiProviderRow);
}

export async function testAiProviderConnection(
  input: AiProviderInput,
  workspaceId: string,
  accessToken?: string,
): Promise<AiProviderTestResult> {
  const client = createInsForgeClient(accessToken);
  const configId = getConfigId(workspaceId);
  const normalized = normalizeInput(input);
  const startedAt = Date.now();
  const cleanApiKey = input.apiKey?.trim();
  let apiKey = cleanApiKey;

  if (!apiKey) {
    const existing = await client.database
      .from("ai_provider_configs")
      .select("api_key_ciphertext")
      .eq("id", configId)
      .maybeSingle();

    if (existing.error) {
      throw new Error(`读取已有 AI 配置失败: ${getInsForgeErrorMessage(existing.error)}`);
    }

    const encrypted = (existing.data as Pick<AiProviderRow, "api_key_ciphertext"> | null)?.api_key_ciphertext;
    if (!encrypted) {
      throw new Error("测试连接需要先填写 API Key");
    }

    apiKey = decryptApiKey(encrypted);
  }

  const response = await fetch(`${normalized.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: normalized.model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 4,
      temperature: 0,
    }),
  });

  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      message: `连接失败：${response.status} ${trimError(text)}`,
      latencyMs,
    };
  }

  return {
    ok: true,
    message: "连接成功，模型可以正常响应",
    latencyMs,
  };
}

export async function getAiProviderRuntimeConfig(
  workspaceId: string,
  accessToken?: string,
): Promise<AiProviderRuntimeConfig | null> {
  const client = createInsForgeClient(accessToken);
  const configId = getConfigId(workspaceId);
  const result = await client.database
    .from("ai_provider_configs")
    .select("base_url,model,generation_prompt,api_key_ciphertext,is_enabled")
    .eq("id", configId)
    .maybeSingle();

  if (result.error && getInsForgeErrorMessage(result.error).includes("generation_prompt")) {
    const legacyResult = await client.database
      .from("ai_provider_configs")
      .select("base_url,model,api_key_ciphertext,is_enabled")
      .eq("id", configId)
      .maybeSingle();

    if (legacyResult.error) {
      throw new Error(`读取 AI 运行配置失败: ${getInsForgeErrorMessage(legacyResult.error)}`);
    }

    if (!legacyResult.data) return null;
    const row = legacyResult.data as Pick<AiProviderRow, "base_url" | "model" | "api_key_ciphertext" | "is_enabled">;
    if (!row.api_key_ciphertext) return null;
    return {
      baseUrl: row.base_url,
      model: row.model,
      generationPrompt: defaultGenerationPrompt,
      apiKey: decryptApiKey(row.api_key_ciphertext),
      isEnabled: row.is_enabled,
    };
  }

  if (result.error) {
    throw new Error(`读取 AI 运行配置失败: ${getInsForgeErrorMessage(result.error)}`);
  }

  if (!result.data) return null;
  const row = result.data as Pick<
    AiProviderRow,
    "base_url" | "model" | "generation_prompt" | "api_key_ciphertext" | "is_enabled"
  >;
  if (!row.api_key_ciphertext) return null;

  return {
    baseUrl: row.base_url,
    model: row.model,
    generationPrompt: row.generation_prompt?.trim() || defaultGenerationPrompt,
    apiKey: decryptApiKey(row.api_key_ciphertext),
    isEnabled: row.is_enabled,
  };
}

function normalizeInput(input: AiProviderInput) {
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
  const model = input.model.trim();
  const generationPrompt = input.generationPrompt?.trim() || defaultGenerationPrompt;

  if (!baseUrl) {
    throw new Error("Base URL 不能为空");
  }

  try {
    const url = new URL(baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("invalid");
    }
  } catch {
    throw new Error("Base URL 格式不正确");
  }

  if (!model) {
    throw new Error("模型名不能为空");
  }

  return {
    provider: input.provider,
    baseUrl,
    model,
    generationPrompt,
    isEnabled: input.isEnabled,
  };
}

function toAiProviderConfig(row: AiProviderRow): AiProviderConfig {
  return {
    provider: row.provider,
    baseUrl: row.base_url,
    model: row.model,
    generationPrompt: row.generation_prompt?.trim() || defaultGenerationPrompt,
    keyHint: row.key_hint,
    isEnabled: row.is_enabled,
    updatedAt: formatDate(row.updated_at),
  };
}

function trimError(value: string) {
  return value.replace(/\s+/g, " ").slice(0, 160) || "请检查 Base URL、模型名和 API Key";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

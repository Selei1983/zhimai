import "server-only";

import { sourceLabel } from "@/lib/captures/source-types";
import { getAiProviderRuntimeConfig } from "@/lib/ai/config";

type DraftInput = {
  note?: string | null;
  rawContent: string;
  selectedText?: string | null;
  sourceTitle?: string | null;
  sourceType: string;
  workspaceId: string;
  accessToken?: string;
};

export async function generateWikiDraft(input: DraftInput): Promise<string | null> {
  const config = await getAiProviderRuntimeConfig(input.workspaceId, input.accessToken);
  if (!config?.isEnabled) return null;

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: config.generationPrompt,
        },
        {
          role: "user",
          content: buildUserPrompt(input),
        },
      ],
      temperature: 0.2,
      max_tokens: 1800,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI 生成失败：${response.status} ${text.slice(0, 160)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  return content || null;
}

function buildUserPrompt(input: DraftInput) {
  return [
    `来源类型：${sourceLabel(input.sourceType)}`,
    `标题：${input.sourceTitle || "未命名收集"}`,
    input.note ? `用户备注：${input.note}` : "",
    "原始内容：",
    input.selectedText || input.rawContent,
    "",
    "请直接输出 Markdown 正文，不要解释你的工作过程。",
  ]
    .filter(Boolean)
    .join("\n");
}

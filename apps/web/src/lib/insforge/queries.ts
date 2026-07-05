import { getAiProviderConfig } from "@/lib/ai/config";
import { createInsForgeClient } from "@/lib/insforge/client";
import {
  getInsForgeErrorMessage,
  type InsForgeCaptureRow,
  type InsForgeLibraryRow,
  type InsForgePageRow,
  toCapture,
  toWikiPage,
} from "@/lib/insforge/mappers";
import type { ZhimaiInitialData } from "@/lib/db/queries";

export async function getInsForgeInitialData(workspaceId: string, accessToken?: string): Promise<ZhimaiInitialData> {
  const client = createInsForgeClient(accessToken);

  const [librariesResult, pagesResult, capturesResult, aiConfig] = await Promise.all([
    client.database
      .from("libraries")
      .select("id,name,sort_order,folders(id,name,sort_order)")
      .eq("workspace_id", workspaceId)
      .order("sort_order", { ascending: true }),
    client.database
      .from("wiki_pages")
      .select("id,title,type,status,updated_at,content_markdown,libraries(name),folders(name)")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false }),
    client.database
      .from("captures")
      .select("id,source_type,source_title,status,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    getAiProviderConfig(workspaceId, accessToken).catch((error) => {
      console.warn("Failed to load AI config.", error);
      return null;
    }),
  ]);

  assertNoError("读取知识库目录失败", librariesResult.error);
  assertNoError("读取 Wiki 页面失败", pagesResult.error);
  assertNoError("读取收集箱失败", capturesResult.error);

  const libraries = ((librariesResult.data ?? []) as InsForgeLibraryRow[]).map((library) => ({
    name: library.name,
    folders: [...(library.folders ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((folder) => folder.name),
  }));

  return {
    libraries,
    wikiPages: ((pagesResult.data ?? []) as InsForgePageRow[]).map(toWikiPage),
    captures: ((capturesResult.data ?? []) as InsForgeCaptureRow[]).map(toCapture),
    aiConfig,
  };
}

function assertNoError(message: string, error: unknown) {
  if (error) {
    throw new Error(`${message}: ${getInsForgeErrorMessage(error)}`);
  }
}

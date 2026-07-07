import { prisma } from "@/lib/db/prisma";
import { shouldUseInsForge, workspaceId } from "@/lib/backend";
import { normalizeSourceType, parserLabel, sourceLabel } from "@/lib/captures/source-types";
import { getInsForgeInitialData } from "@/lib/insforge/queries";
import { getUserWorkspaceContext } from "@/lib/insforge/workspace";
import {
  fallbackAiConfig,
  fallbackCaptures,
  fallbackLibraries,
  fallbackWikiPages,
  type AiProviderConfig,
  type Capture,
  type LibraryTree,
  type WikiPage,
} from "@/lib/zhimai-data";

export type ZhimaiInitialData = {
  wikiPages: WikiPage[];
  captures: Capture[];
  libraries: LibraryTree[];
  aiConfig: AiProviderConfig | null;
};

export async function getZhimaiInitialData(accessToken?: string): Promise<ZhimaiInitialData> {
  if (shouldUseInsForge()) {
    if (!accessToken) {
      return {
        libraries: [],
        wikiPages: [],
        captures: [],
        aiConfig: fallbackAiConfig,
      };
    }

    try {
      const context = await getUserWorkspaceContext(accessToken);
      return await getInsForgeInitialData(context.workspaceId, context.accessToken);
    } catch (error) {
      console.error("Failed to load InsForge data.", error);
      throw error;
    }
  }

  try {
    const [libraries, pages, captures] = await Promise.all([
      prisma.library.findMany({
        where: { workspaceId },
        include: {
          folders: {
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.wikiPage.findMany({
        where: { workspaceId },
        include: {
          library: true,
          folder: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.capture.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      libraries: libraries.map((library) => ({
        name: library.name,
        folders: library.folders.map((folder) => folder.name),
      })),
      wikiPages: pages.map((page) => ({
        id: page.id,
        title: page.title,
        type: toWikiType(page.type),
        library: page.library.name,
        folder: page.folder?.name ?? "未归档",
        tags: inferTags(page),
        aiState: page.status === "published" ? "已成文" : "草稿",
        updatedAt: formatDate(page.updatedAt),
        content: page.contentMarkdown.split(/\n{2,}/).filter(Boolean),
      })),
      captures: captures.map((capture) => ({
        id: capture.id,
        title: capture.sourceTitle ?? "未命名收集",
        source: sourceLabel(capture.sourceType),
        sourceType: normalizeSourceType(capture.sourceType),
        parser: parserLabel(capture.sourceType),
        status: captureStatus(capture.status),
        suggestedAction: capture.status === "pending" ? pendingAction(normalizeSourceType(capture.sourceType)) : "确认写入",
      })),
      aiConfig: fallbackAiConfig,
    };
  } catch (error) {
    console.error("Failed to load database data, falling back to fixtures.", error);
    return {
      libraries: fallbackLibraries,
      wikiPages: fallbackWikiPages,
      captures: fallbackCaptures,
      aiConfig: fallbackAiConfig,
    };
  }
}

function toWikiType(type: string): WikiPage["type"] {
  if (["观点", "方法", "产品决策", "问题", "模板", "决策"].includes(type)) {
    return type as WikiPage["type"];
  }
  return "观点";
}

function inferTags(page: { type: string; library: { name: string }; folder: { name: string } | null }) {
  return [page.type, page.library.name, page.folder?.name].filter(Boolean) as string[];
}

function captureStatus(status: string): Capture["status"] {
  const labels: Record<string, Capture["status"]> = {
    pending: "未整理",
    processing: "已分析",
    processed: "待确认",
    confirmed: "已写入",
  };
  return labels[status] ?? "未整理";
}

function pendingAction(sourceType: Capture["sourceType"]) {
  const actions: Record<Capture["sourceType"], string> = {
    text: "规划归类",
    web: "解析并归类",
    video: "转写后归类",
    file: "抽取后归类",
  };
  return actions[sourceType];
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

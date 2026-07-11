import { getAiProviderConfig } from "@/lib/ai/config";
import { createInsForgeClient } from "@/lib/insforge/client";
import {
  getInsForgeErrorMessage,
  type InsForgeCaptureRow,
  type InsForgeLibraryRow,
  type InsForgePageRow,
  formatDate,
  toCapture,
  toWikiPage,
} from "@/lib/insforge/mappers";
import type { ZhimaiInitialData } from "@/lib/db/queries";
import { fallbackGraphOverview, type GraphOverview } from "@/lib/zhimai-data";

export async function getInsForgeInitialData(workspaceId: string, accessToken?: string): Promise<ZhimaiInitialData> {
  const client = createInsForgeClient(accessToken);

  const [librariesResult, pagesResult, capturesResult, aiConfig, graph] = await Promise.all([
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
    getInsForgeGraphOverview(workspaceId, accessToken).catch((error) => {
      console.warn("Failed to load graph overview.", error);
      return fallbackGraphOverview;
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
    graph,
  };
}

type TopicNodeRow = {
  id: string;
  name: string;
  summary: string | null;
  level: string;
  status: string;
  page_id: string | null;
  updated_at: string;
};

type KnowledgeAtomRow = {
  id: string;
  topic_id: string | null;
};

type CategoryPlanningRunRow = {
  id: string;
  action: string;
  target_title: string;
  reason: string;
  confidence: number | null;
  atom_ids_json: unknown;
  status: string;
  created_at: string;
};

async function getInsForgeGraphOverview(workspaceId: string, accessToken?: string): Promise<GraphOverview> {
  const client = createInsForgeClient(accessToken);
  const [topicsResult, atomsResult, planningResult] = await Promise.all([
    client.database
      .from("topic_nodes")
      .select("id,name,summary,level,status,page_id,updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(30),
    client.database
      .from("knowledge_atoms")
      .select("id,topic_id")
      .eq("workspace_id", workspaceId)
      .limit(500),
    client.database
      .from("category_planning_runs")
      .select("id,action,target_title,reason,confidence,atom_ids_json,status,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  assertNoError("读取主题节点失败", topicsResult.error);
  assertNoError("读取知识原子失败", atomsResult.error);
  assertNoError("读取类目规划失败", planningResult.error);

  const atoms = (atomsResult.data ?? []) as KnowledgeAtomRow[];
  const atomCountByTopic = atoms.reduce<Record<string, number>>((acc, atom) => {
    if (atom.topic_id) {
      acc[atom.topic_id] = (acc[atom.topic_id] ?? 0) + 1;
    }
    return acc;
  }, {});

  return {
    topics: ((topicsResult.data ?? []) as TopicNodeRow[]).map((topic) => ({
      id: topic.id,
      name: topic.name,
      level: topic.level,
      status: topic.status,
      summary: topic.summary ?? "暂无摘要",
      pageId: topic.page_id ?? undefined,
      atomCount: atomCountByTopic[topic.id] ?? 0,
      updatedAt: formatDate(topic.updated_at),
    })),
    recentPlanningRuns: ((planningResult.data ?? []) as CategoryPlanningRunRow[]).map((run) => ({
      id: run.id,
      action: run.action,
      targetTitle: run.target_title,
      reason: run.reason,
      confidence: run.confidence ?? undefined,
      atomCount: Array.isArray(run.atom_ids_json) ? run.atom_ids_json.length : 0,
      status: run.status,
      createdAt: formatDate(run.created_at),
    })),
    atomCount: atoms.length,
  };
}

function assertNoError(message: string, error: unknown) {
  if (error) {
    throw new Error(`${message}: ${getInsForgeErrorMessage(error)}`);
  }
}

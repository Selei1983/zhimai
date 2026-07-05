import "server-only";

import { createHash } from "crypto";
import { createInsForgeClient } from "@/lib/insforge/client";
import { getInsForgeErrorMessage } from "@/lib/insforge/mappers";
import type { AppUser } from "@/lib/zhimai-data";

type WorkspaceContext = {
  accessToken: string;
  client: ReturnType<typeof createInsForgeClient>;
  user: AppUser;
  workspaceId: string;
};

type CurrentUserResponse = {
  user?: {
    id?: string;
    email?: string;
    name?: string;
    displayName?: string;
    profile?: {
      displayName?: string;
      name?: string;
    };
  } | null;
};

export async function getUserWorkspaceContext(accessToken: string | undefined): Promise<WorkspaceContext> {
  const cleanToken = accessToken?.trim();
  if (!cleanToken) {
    throw new Error("请先登录后再操作知识库");
  }

  const client = createInsForgeClient(cleanToken);
  const currentUser = await client.auth.getCurrentUser();

  if (currentUser.error) {
    throw new Error(`登录状态已失效: ${getInsForgeErrorMessage(currentUser.error)}`);
  }

  const user = normalizeUser(currentUser.data as CurrentUserResponse | null);
  const workspaceId = getWorkspaceIdForUser(user.id);

  await ensureWorkspace(client, workspaceId, user);

  return {
    accessToken: cleanToken,
    client,
    user,
    workspaceId,
  };
}

export function getWorkspaceIdForUser(userId: string) {
  const hash = createHash("sha256").update(userId).digest("hex").slice(0, 24);
  return `workspace-${hash}`;
}

async function ensureWorkspace(client: WorkspaceContext["client"], workspaceId: string, user: AppUser) {
  const name = `${user.name || user.email.split("@")[0]} 的知识空间`;
  const result = await client.database
    .from("workspaces")
    .upsert({
      id: workspaceId,
      name,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (result.error) {
    throw new Error(`创建个人空间失败: ${getInsForgeErrorMessage(result.error)}`);
  }
}

function normalizeUser(response: CurrentUserResponse | null): AppUser {
  const rawUser = response?.user;
  const id = rawUser?.id;
  const email = rawUser?.email;

  if (!id || !email) {
    throw new Error("登录状态异常，未取得用户信息");
  }

  const name =
    rawUser.name ||
    rawUser.displayName ||
    rawUser.profile?.displayName ||
    rawUser.profile?.name ||
    email.split("@")[0];

  return {
    id,
    email,
    name,
  };
}

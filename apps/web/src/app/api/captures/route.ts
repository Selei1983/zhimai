import { NextResponse } from "next/server";
import { shouldUseInsForge, workspaceId } from "@/lib/backend";
import { normalizeSourceType } from "@/lib/captures/source-types";
import { prisma } from "@/lib/db/prisma";
import { createInsForgeCapture } from "@/lib/insforge/actions";
import { getUserWorkspaceContext } from "@/lib/insforge/workspace";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      rawContent?: string;
      note?: string;
      sourceTitle?: string;
      sourceUrl?: string;
      selectedText?: string;
      sourceType?: string;
    };

    const rawContent = body.rawContent?.trim() || body.selectedText?.trim();
    const sourceType = normalizeSourceType(body.sourceType ?? "web");

    if (!rawContent) {
      return NextResponse.json({ error: "收集内容不能为空" }, { status: 400 });
    }

    if (shouldUseInsForge()) {
      const context = await getUserWorkspaceContext(readBearerToken(request));
      const capture = await createInsForgeCapture({
        rawContent,
        note: body.note,
        sourceTitle: body.sourceTitle,
        sourceUrl: body.sourceUrl,
        selectedText: body.selectedText,
        sourceType,
      }, context.workspaceId, context.accessToken);

      return NextResponse.json({ data: capture });
    }

    const capture = await prisma.capture.create({
      data: {
        workspaceId,
        sourceType,
        sourceTitle: body.sourceTitle?.trim() || rawContent.split(/\n/)[0].slice(0, 40),
        sourceUrl: body.sourceUrl?.trim(),
        selectedText: body.selectedText?.trim(),
        rawContent,
        note: body.note?.trim(),
        status: "pending",
      },
    });

    return NextResponse.json({
      data: {
        id: capture.id,
        title: capture.sourceTitle ?? "未命名收集",
        status: capture.status,
      },
    });
  } catch (error) {
    console.error("Failed to create capture from API.", error);
    const message = error instanceof Error ? error.message : "保存到收集箱失败";
    const status = message.includes("登录") || message.includes("失效") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

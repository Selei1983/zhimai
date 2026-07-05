import { NextResponse } from "next/server";
import { getZhimaiInitialData } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const accessToken = readBearerToken(request);
    const data = await getZhimaiInitialData(accessToken);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to load initial data.", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 401 });
  }
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "读取个人知识空间失败";
}

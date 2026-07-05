export const workspaceId = "demo-workspace";

export function shouldUseInsForge() {
  return process.env.DATA_BACKEND === "insforge";
}

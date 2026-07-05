import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";

export function encryptApiKey(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptApiKey(payload: string) {
  const data = Buffer.from(payload, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = createDecipheriv(algorithm, getSecretKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function keyHint(apiKey: string) {
  if (apiKey.length <= 8) return "已配置";
  return `•••• ${apiKey.slice(-4)}`;
}

function getSecretKey() {
  const secret = process.env.AI_CONFIG_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error("AI 配置密钥缺失，请设置 AI_CONFIG_SECRET");
  }

  return createHash("sha256").update(secret).digest();
}

import type { Env } from "./types";

const SESSION_COOKIE = "pd_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

function signingSecret(env: Env): string | null {
  const explicit = env.SESSION_SECRET?.trim();
  if (explicit) return `pd-session-v1:${explicit}`;
  const password = env.ADMIN_PASSWORD;
  return password ? `pd-session-v1:derived:${password}` : null;
}

export function isAdminConfigured(env: Env): boolean {
  return Boolean(env.ADMIN_PASSWORD);
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return new Uint8Array(digest);
}

/**
 * Compare SHA-256 digests byte-by-byte so the comparison does not leak the
 * length or matching prefix of the configured password.
 */
export async function verifyAdminPassword(env: Env, candidate: string): Promise<boolean> {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) return false;

  const [candidateDigest, expectedDigest] = await Promise.all([
    sha256(candidate),
    sha256(expected),
  ]);

  let difference = 0;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= (candidateDigest[index] ?? 0) ^ (expectedDigest[index] ?? 0);
  }
  return difference === 0;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function createSessionToken(env: Env): Promise<string | null> {
  const secret = signingSecret(env);
  if (!secret) return null;

  const payload = base64UrlEncode(
    encoder.encode(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }),
    ),
  );
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function verifySessionToken(env: Env, token: string): Promise<boolean> {
  const secret = signingSecret(env);
  if (!secret) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!payload || !signature) return false;

  const signatureBytes = base64UrlDecode(signature);
  if (!signatureBytes || signatureBytes.length !== 32) return false;

  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(payload),
  );
  if (!valid) return false;

  const payloadBytes = base64UrlDecode(payload);
  if (!payloadBytes) return false;

  try {
    const data: unknown = JSON.parse(decoder.decode(payloadBytes));
    if (typeof data !== "object" || data === null) return false;
    const exp = (data as { exp?: unknown }).exp;
    return typeof exp === "number" && exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export async function isAdminRequest(request: Request, env: Env): Promise<boolean> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return false;
  return verifySessionToken(env, token);
}

export async function createSessionCookie(
  request: Request,
  env: Env,
): Promise<string | null> {
  const token = await createSessionToken(env);
  if (!token) return null;

  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

/**
 * Reject cross-site form submissions when the browser provides an Origin
 * header. SameSite=Lax is the primary CSRF defence; this is defence in depth.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/**
 * Pure desktop companion auth & API validation helpers (no Prisma, no server-only).
 *
 * Used by both `/desktop/connect`, `/api/desktop/*`, and `scripts/verify-logic.ts`.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { MAX_INTERVALS, MAX_TARGET_SECONDS } from "@/lib/timer-math";

export const DESKTOP_TOKEN_PREFIX = "unr_";
export const DESKTOP_CODE_TTL_MS = 60 * 1000;
export const DESKTOP_LABEL_MAX = 60;

/** SHA-256 hex digest used for tokens and one-time auth codes at rest. */
export function hashDesktopSecret(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Generate a new revocable personal desktop token (`unr_<base64url>`). */
export function generateDesktopToken(): {
  rawToken: string;
  tokenHash: string;
  prefix: string;
} {
  const secret = randomBytes(32).toString("base64url");
  const rawToken = `${DESKTOP_TOKEN_PREFIX}${secret}`;
  return {
    rawToken,
    tokenHash: hashDesktopSecret(rawToken),
    prefix: rawToken.slice(0, 10),
  };
}

/** Generate a short-lived one-time authorization code for PKCE handoff. */
export function generateDesktopAuthCode(): {
  rawCode: string;
  codeHash: string;
} {
  const rawCode = randomBytes(32).toString("base64url");
  return { rawCode, codeHash: hashDesktopSecret(rawCode) };
}

/** Compute RFC 7636 S256 PKCE code challenge from a verifier. */
export function computePkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

/** Constant-time verification of a PKCE S256 verifier against stored challenge. */
export function verifyPkceChallenge(
  verifier: string,
  expectedChallenge: string,
): boolean {
  if (verifier.length < 43 || verifier.length > 128) return false;
  if (!/^[A-Za-z0-9._~-]+$/.test(verifier)) return false;
  const computed = computePkceChallenge(verifier);
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(expectedChallenge, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Strictly validate an unprivileged localhost callback port (`1024..65535`).
 * Prevents open redirects: `/desktop/connect` ONLY ever redirects to
 * `http://127.0.0.1:<port>/callback`.
 */
export function validateLoopbackPort(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{4,5}$/.test(raw.trim())) return null;
  const port = Number(raw.trim());
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return null;
  return port;
}

/** Validate an opaque CSRF `state` nonce and PKCE S256 `challenge`. */
export function isValidAuthNonce(raw: string | null | undefined): boolean {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(raw);
}

/** Sanitize a device label ("Ubuntu Laptop", hostname, etc.). */
export function sanitizeDeviceLabel(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "Ubuntu Desktop";
  return trimmed.slice(0, DESKTOP_LABEL_MAX);
}

/** Extract `Authorization: Bearer unr_...` from a header string. */
export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1];
  if (!token.startsWith(DESKTOP_TOKEN_PREFIX) || token.length < 24) return null;
  return token;
}

// ---------------------------------------------------------------- API schemas

export const desktopExchangeSchema = z.object({
  code: z.string().min(16).max(256),
  codeVerifier: z.string().min(43).max(128),
});

export const desktopSettingsPatchSchema = z
  .object({
    pomodoroMinutes: z.number().int().min(5).max(120).optional(),
    shortBreakMinutes: z.number().int().min(1).max(60).optional(),
    longBreakMinutes: z.number().int().min(1).max(90).optional(),
    longBreakEvery: z.number().int().min(2).max(12).optional(),
    autoStartBreaks: z.boolean().optional(),
    autoStartNextFocus: z.boolean().optional(),
    soundEnabled: z.boolean().optional(),
    hapticsEnabled: z.boolean().optional(),
    returnAlertsEnabled: z.boolean().optional(),
  })
  .strict();

export const desktopStartSessionSchema = z.object({
  clientKey: z.string().min(4).max(128),
  taskId: z.string().min(1).max(64).nullable().optional(),
  mode: z.enum(["POMODORO", "BASIC", "FLOW", "RECOVERY"]),
  targetSeconds: z.number().int().min(0).max(MAX_TARGET_SECONDS),
  intervals: z.number().int().min(1).max(MAX_INTERVALS),
  shortBreakSeconds: z.number().int().min(60).max(3600).optional(),
});

export const desktopTimerActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("heartbeat") }),
  z.object({
    action: z.literal("advance"),
    nextIndex: z.number().int().min(0).max(30),
    completed: z.boolean().optional().default(true),
    resume: z.boolean().optional(),
  }),
  z.object({ action: z.literal("appendFlowRound") }),
  z.object({
    action: z.literal("extend"),
    seconds: z.number().int().min(1).max(1800),
  }),
  z.object({
    action: z.literal("returnNote"),
    note: z.string().max(200),
  }),
  z.object({
    action: z.literal("end"),
    completedTask: z.boolean().optional(),
    reason: z.enum(["TARGET_REACHED", "USER_STOPPED"]).optional(),
  }),
  z.object({
    action: z.literal("adjust"),
    minutes: z.number().int().min(1).max(12 * 60),
  }),
]);

export const desktopToggleTaskSchema = z.object({
  done: z.boolean(),
  note: z.string().trim().max(500).optional(),
  minutes: z.number().int().min(1).max(12 * 60).optional(),
});

"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  DESKTOP_CODE_TTL_MS,
  generateDesktopAuthCode,
  isValidAuthNonce,
  sanitizeDeviceLabel,
  validateLoopbackPort,
} from "@/lib/desktop-auth-utils";

/**
 * Clerk-authenticated Server Action called when the user clicks
 * "Connect Ubuntu app" on `/desktop/connect`.
 *
 * Mints a 60-second single-use PKCE authorization code (hashed in Postgres)
 * and redirects strictly to `http://127.0.0.1:<port>/callback`.
 */
export async function approveDesktopConnect(formData: FormData): Promise<void> {
  const user = await requireUser();

  const port = validateLoopbackPort(String(formData.get("port") ?? ""));
  const state = String(formData.get("state") ?? "");
  const challenge = String(formData.get("challenge") ?? "");
  const label = sanitizeDeviceLabel(String(formData.get("label") ?? ""));

  if (!port || !isValidAuthNonce(state) || !isValidAuthNonce(challenge)) {
    redirect("/settings#desktop");
  }

  const { rawCode, codeHash } = generateDesktopAuthCode();
  const expiresAt = new Date(Date.now() + DESKTOP_CODE_TTL_MS);

  await prisma.desktopAuthCode.create({
    data: {
      userId: user.id,
      codeHash,
      codeChallenge: challenge,
      label,
      expiresAt,
    },
  });

  const callback = new URL(`http://127.0.0.1:${port}/callback`);
  callback.searchParams.set("code", rawCode);
  callback.searchParams.set("state", state);

  redirect(callback.toString());
}

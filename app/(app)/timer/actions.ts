"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import {
  adjustUserLoggedTime,
  advanceUserInterval,
  appendUserFlowRound,
  discardUserSession,
  endUserSession,
  extendUserInterval,
  heartbeatUserSession,
  pauseUserSession,
  resumeUserSession,
  setUserReturnNote,
  startUserRecoverySession,
  startUserSession,
  type SessionSnapshot,
  type StartSessionInput,
} from "@/lib/timer-service";
import { adjustSessionSchema } from "@/lib/validation";

export async function startSession(
  input: StartSessionInput,
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
  return startUserSession(user, input);
}

export async function pauseSession(
  sessionId: string,
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
  return pauseUserSession(user, sessionId);
}

export async function resumeSession(
  sessionId: string,
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
  return resumeUserSession(user, sessionId);
}

export async function heartbeat(
  sessionId: string,
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
  return heartbeatUserSession(user, sessionId);
}

export async function advanceInterval(
  sessionId: string,
  nextIndex: number,
  completed: boolean,
  options: { resume?: boolean } = {},
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
  return advanceUserInterval(user, sessionId, nextIndex, completed, options);
}

export async function appendFlowRound(
  sessionId: string,
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
  return appendUserFlowRound(user, sessionId);
}

export async function setReturnNote(
  sessionId: string,
  note: string,
): Promise<void> {
  const user = await requireUser();
  await setUserReturnNote(user, sessionId, note);
}

export async function extendCurrentInterval(
  sessionId: string,
  seconds: number,
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
  return extendUserInterval(user, sessionId, seconds);
}

export async function endSession(
  sessionId: string,
  options: {
    completedTask?: boolean;
    reason?: "TARGET_REACHED" | "USER_STOPPED";
  } = {},
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
  const snap = await endUserSession(user, sessionId, options);

  revalidatePath("/");
  revalidatePath("/day");
  revalidatePath("/tasks");
  revalidatePath("/habits");
  revalidatePath("/habits/stats");
  revalidatePath("/stats");

  return snap;
}

export async function startRecoverySession(): Promise<void> {
  const user = await requireUser();
  await startUserRecoverySession(user);

  revalidatePath("/timer");
  revalidatePath("/");
}

export async function adjustLoggedTime(input: {
  sessionId: string;
  minutes: number;
}): Promise<
  | { status: "ok"; loggedSeconds: number }
  | { status: "error"; message: string }
> {
  const user = await requireUser();
  const parsed = adjustSessionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "That didn't look right.",
    };
  }

  const result = await adjustUserLoggedTime(
    user,
    parsed.data.sessionId,
    parsed.data.minutes,
  );

  if (result.status === "ok") {
    revalidatePath("/");
    revalidatePath("/day");
    revalidatePath("/tasks");
    revalidatePath("/habits");
    revalidatePath("/habits/stats");
    revalidatePath("/stats");
  }

  return result;
}

export async function discardSession(sessionId: string): Promise<void> {
  const user = await requireUser();
  await discardUserSession(user, sessionId);

  revalidatePath("/timer");
}

"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Laptop, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { approveDesktopConnect } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      loading={pending}
      className="min-h-11 w-full rounded-full"
    >
      {pending ? "Connecting…" : "Connect Ubuntu app"}
    </Button>
  );
}

export function ConnectCard({
  port,
  state,
  challenge,
  defaultLabel,
  userName,
  userEmail,
}: {
  port: number;
  state: string;
  challenge: string;
  defaultLabel: string;
  userName: string | null;
  userEmail: string | null;
}) {
  return (
    <form action={approveDesktopConnect} className="space-y-6">
      <input type="hidden" name="port" value={port} />
      <input type="hidden" name="state" value={state} />
      <input type="hidden" name="challenge" value={challenge} />

      <div className="bg-muted/40 border-border/60 flex items-center gap-3 rounded-2xl border px-4 py-3">
        <div className="bg-primary/12 text-primary grid size-10 shrink-0 place-items-center rounded-full">
          <Laptop className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-micro text-muted-foreground">Signed in as</p>
          <p className="truncate text-label font-medium text-foreground">
            {userName || userEmail || "Your Unravel account"}
          </p>
          {userName && userEmail && (
            <p className="truncate text-micro text-muted-foreground">{userEmail}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="desktop-label">Device name</Label>
        <Input
          id="desktop-label"
          name="label"
          defaultValue={defaultLabel}
          maxLength={60}
          placeholder="Ubuntu Laptop"
          className="min-h-11 rounded-xl"
        />
        <p className="text-micro text-muted-foreground">
          Shown in Settings so you can recognize and revoke this computer anytime.
        </p>
      </div>

      <div className="space-y-2.5">
        <SubmitButton />
        <Button asChild variant="ghost" className="min-h-10 w-full rounded-full">
          <Link href="/">Cancel</Link>
        </Button>
      </div>

      <p className="text-micro text-muted-foreground flex items-start gap-2 leading-relaxed">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
        <span>
          Grants access only to your own timer, settings, and read-only statistics.
          No database credentials are shared, and you can revoke access anytime in{" "}
          <Link href="/settings#desktop" className="underline underline-offset-2 hover:text-foreground">
            Settings
          </Link>
          .
        </span>
      </p>
    </form>
  );
}

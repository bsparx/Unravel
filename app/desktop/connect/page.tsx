import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { ensureUser } from "@/lib/auth";
import {
  isValidAuthNonce,
  sanitizeDeviceLabel,
  validateLoopbackPort,
} from "@/lib/desktop-auth-utils";

import { ConnectCard } from "./_components/connect-card";

export const metadata = { title: "Connect Ubuntu desktop" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DesktopConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawPort = first(params.port);
  const rawState = first(params.state);
  const rawChallenge = first(params.challenge);
  const rawDevice = first(params.device);

  const user = await ensureUser();
  if (!user) {
    const query = new URLSearchParams();
    if (rawPort) query.set("port", rawPort);
    if (rawState) query.set("state", rawState);
    if (rawChallenge) query.set("challenge", rawChallenge);
    if (rawDevice) query.set("device", rawDevice);
    const returnTo = query.size > 0 ? `/desktop/connect?${query.toString()}` : "/desktop/connect";
    redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  }

  const port = validateLoopbackPort(rawPort);
  const valid =
    port !== null && isValidAuthNonce(rawState) && isValidAuthNonce(rawChallenge);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <div className="bg-card border-[var(--card-edge)] shadow-[var(--card-shadow)] space-y-6 rounded-3xl border p-6 backdrop-blur-xl sm:p-8">
        <header className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BrandMark className="size-7" />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-normal">
              Connect Unravel Desktop
            </h1>
            <p className="text-label text-muted-foreground">
              Pair your Ubuntu companion app with your Unravel account.
            </p>
          </div>
        </header>

        {valid && rawState && rawChallenge ? (
          <ConnectCard
            port={port}
            state={rawState}
            challenge={rawChallenge}
            defaultLabel={sanitizeDeviceLabel(rawDevice)}
            userName={user.name}
            userEmail={user.email}
          />
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-label text-muted-foreground">
              This sign-in link is missing required desktop parameters. Start
              sign-in from the Ubuntu app, or create a manual token in Settings.
            </p>
            <Button asChild className="min-h-10 w-full rounded-full">
              <Link href="/settings#desktop">Open Desktop settings</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

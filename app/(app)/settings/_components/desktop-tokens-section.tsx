"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Laptop, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createManualDesktopToken, revokeDesktopToken } from "../actions";

export type DesktopTokenItem = {
  id: string;
  label: string;
  prefix: string;
  createdLabel: string;
  lastUsedLabel: string | null;
};

export function DesktopTokensSection({
  tokens,
}: {
  tokens: DesktopTokenItem[];
}) {
  const [label, setLabel] = useState("");
  const [revealed, setRevealed] = useState<{ token: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const onCreate = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createManualDesktopToken(label);
      if (res.status === "error") {
        toast.error(res.message);
        return;
      }
      setRevealed({ token: res.rawToken, label: res.label });
      setCopied(false);
      setLabel("");
      toast.success("Desktop token created. Copy it now — it won't be shown again.");
    });
  };

  const onCopy = async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.token);
      setCopied(true);
      toast.success("Token copied to clipboard.");
    } catch {
      toast.error("Could not copy automatically — select and copy the token.");
    }
  };

  const onRevoke = (id: string, name: string) => {
    startTransition(async () => {
      await revokeDesktopToken(id);
      toast.success(`Disconnected “${name}”.`);
    });
  };

  return (
    <section id="desktop" className="scroll-mt-8 space-y-5">
      <div>
        <h2 className="font-display text-title flex items-center gap-2">
          <Laptop className="size-4.5 text-muted-foreground" aria-hidden />
          Desktop companion
        </h2>
        <p className="text-muted-foreground mt-1 text-label">
          Connect the Ubuntu desktop app using one-click browser sign-in, or generate
          a manual token below. Each device gets its own revocable token — no database
          credentials are ever shared.
        </p>
      </div>

      {revealed && (
        <div
          role="status"
          className="border-primary/35 bg-primary/5 space-y-3 rounded-2xl border p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-label font-medium">
              New token for “{revealed.label}”
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void onCopy()}
              className="rounded-full"
            >
              {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <code className="bg-background/80 border-border block overflow-x-auto rounded-xl border px-3 py-2 font-mono text-xs break-all select-all">
            {revealed.token}
          </code>
          <p className="text-micro text-muted-foreground">
            Paste this into the Ubuntu desktop app. For your security, it is stored
            hashed and will not be shown again once you leave this page.
          </p>
        </div>
      )}

      <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <Label htmlFor="desktop-token-label">Manual token (optional)</Label>
          <Input
            id="desktop-token-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={60}
            placeholder="e.g. Ubuntu Laptop"
            className="min-h-10 rounded-xl"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          loading={pending}
          className="min-h-10 rounded-full px-5"
        >
          <KeyRound className="size-3.5" aria-hidden />
          Create token
        </Button>
      </form>

      {tokens.length === 0 ? (
        <p className="text-muted-foreground border-border/70 rounded-2xl border border-dashed px-4 py-5 text-center text-label">
          No desktop apps connected yet.
        </p>
      ) : (
        <ul className="divide-border/70 border-border/70 bg-card/70 divide-y rounded-2xl border">
          {tokens.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-label font-medium">{t.label}</p>
                <p className="text-micro text-muted-foreground">
                  <span className="font-mono">{t.prefix}…</span> · Added {t.createdLabel}
                  {t.lastUsedLabel ? ` · Last active ${t.lastUsedLabel}` : " · Never used"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => onRevoke(t.id, t.label)}
                className="text-muted-foreground hover:text-destructive rounded-full"
              >
                <Trash2 className="size-3.5" aria-hidden />
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

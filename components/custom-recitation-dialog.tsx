"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CustomRecitationRow } from "@/lib/heart-data";
import { RECITATION_MAX } from "@/lib/validation";

export type CustomRecitationFields = Omit<CustomRecitationRow, "id">;

/**
 * Write a recitation of your own: a name, and the words in any of Arabic,
 * transliteration and English. Whatever's filled shows in the reader, in that
 * order, the same as the catalogue's.
 */
export function CustomRecitationDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: CustomRecitationRow | null;
  /** Resolves to an error message, or null once saved. */
  onSave: (fields: CustomRecitationFields) => Promise<string | null>;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<CustomRecitationFields>({
    title: initial?.title ?? "",
    arabic: initial?.arabic ?? "",
    transliteration: initial?.transliteration ?? "",
    translation: initial?.translation ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof CustomRecitationFields) => (event: { target: { value: string } }) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    const message = await onSave(fields);
    if (message) {
      setError(message);
      setSaving(false);
    }
  };

  const ready = fields.title.trim() && (fields.arabic.trim() || fields.transliteration.trim() || fields.translation.trim());

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        sheetOnPhone
        className="max-sm:bg-background max-sm:content-start sm:max-w-xl sm:rounded-[26px] sm:p-6 lg:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">
            {initial ? "Edit your recitation" : "Write your own"}
          </DialogTitle>
          <DialogDescription>A name, and the words in whichever of the three you have.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) void save();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="custom-title">Name</Label>
            <Input
              id="custom-title"
              value={fields.title}
              onChange={set("title")}
              maxLength={RECITATION_MAX.title}
              placeholder="Du'a for my parents"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-arabic">Arabic</Label>
            <Textarea
              id="custom-arabic"
              value={fields.arabic}
              onChange={set("arabic")}
              maxLength={RECITATION_MAX.text}
              dir="rtl"
              lang="ar"
              rows={3}
              placeholder="رَّبِّ ٱرْحَمْهُمَا كَمَا رَبَّيَانِى صَغِيرًۭا"
              className="recite-arabic text-xl leading-[2]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-transliteration">Transliteration</Label>
            <Textarea
              id="custom-transliteration"
              value={fields.transliteration}
              onChange={set("transliteration")}
              maxLength={RECITATION_MAX.text}
              rows={2}
              placeholder="Rabbir-hamhuma kama rabbayani sagheera"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-translation">Translation</Label>
            <Textarea
              id="custom-translation"
              value={fields.translation}
              onChange={set("translation")}
              maxLength={RECITATION_MAX.text}
              rows={2}
              placeholder="My Lord, have mercy upon them as they brought me up [when I was] small."
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-label">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2 sm:-mx-6 sm:-mb-6 sm:rounded-b-[26px] sm:px-6">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready || saving} loading={saving}>
              {initial ? "Save" : "Add to my set"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";

import { SCENE_ART } from "@/components/scenes/scene-card";
import { SCENE_KEYS } from "@/lib/scenes";
import { SCENES, stageAt } from "@/lib/scenes";
import { TEND_DAYS } from "@/lib/tending";

/** Development only: every scene, one level slider, and the stage it adds. */
export function ScenePreview() {
  const [level, setLevel] = useState(TEND_DAYS);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-5 py-8 md:px-8">
      <div className="space-y-2">
        <h1 className="text-display">Scenes</h1>
        <label className="flex items-center gap-3 text-label">
          Level <span className="w-6 font-mono tabular-nums">{level}</span>
          <input
            type="range"
            min={0}
            max={TEND_DAYS}
            value={level}
            onChange={(event) => setLevel(Number(event.target.value))}
            className="w-64"
          />
        </label>
      </div>
      {SCENE_KEYS.map((tab) => {
        const Art = SCENE_ART[tab];
        const scene = SCENES[tab];
        const stage = stageAt(scene, level);
        return (
          <section key={tab} data-scene={tab} className="space-y-2">
            <p className="text-label">
              <span className="font-medium">{scene.title}</span>{" "}
              <span className="text-muted-foreground">{stage ? `+ ${stage.name}` : scene.base}</span>
            </p>
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl sm:aspect-[2/1] lg:aspect-[21/9]">
              <Art level={level} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

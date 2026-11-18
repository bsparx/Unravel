import type { MindTab } from "@/lib/mind-tabs";
import { TEND_DAYS, type Tending } from "@/lib/tending";

/**
 * The six Mind scenes: what each one is, and the fourteen things that come
 * into it, one for each day of the last two weeks you kept the practice.
 * Stages appear in order and leave in reverse: the newest is the first to
 * go when a day is missed. See lib/tending.ts for the rule.
 *
 * Names are written to read in a sentence: "Today brought {name}", "Sit
 * today to bring {name}", "Read today to keep {name}".
 */

export type SceneStage = { id: string; name: string };

export type Scene = {
  /** "The moonlit garden". */
  title: string;
  /** "garden", for "The garden is whole." */
  noun: string;
  /** What's there with no days kept. */
  base: string;
  stages: readonly SceneStage[];
  /** The day's act, as an imperative: "Sit today". */
  act: string;
};

const stages = (list: [string, string][]): SceneStage[] => list.map(([id, name]) => ({ id, name }));

export const SCENES: Record<MindTab, Scene> = {
  meditate: {
    title: "The moonlit garden",
    noun: "garden",
    base: "a moonlit meadow",
    act: "Sit today",
    stages: stages([
      ["flowers", "wildflowers in the grass"],
      ["pond", "a still pond"],
      ["maple", "a young maple"],
      ["lantern", "a stone lantern"],
      ["fireflies", "fireflies"],
      ["path", "a stepping-stone path"],
      ["willow", "a weeping willow"],
      ["bridge", "a footbridge"],
      ["koi", "koi in the pond"],
      ["lilies", "water lilies"],
      ["pavilion", "a pavilion on the hill"],
      ["cherry", "a cherry tree in blossom"],
      ["heron", "a night heron"],
      ["full-moon", "the full moon on the water"],
    ]),
  },
  gratitude: {
    title: "The lantern terrace",
    noun: "terrace",
    base: "a terrace at dusk",
    act: "Write today's page",
    stages: stages([
      ["lantern-1", "the first lantern"],
      ["rosemary", "a pot of rosemary"],
      ["lanterns-3", "two more lanterns"],
      ["tea", "a teapot and two cups"],
      ["window", "a lit window"],
      ["jasmine", "jasmine on the post"],
      ["bread", "bread and figs"],
      ["garland", "the garland, full"],
      ["cat", "a cat asleep on the chair"],
      ["candles", "candles on the table"],
      ["fireflies", "fireflies over the hedge"],
      ["olive", "paper lanterns in the olive tree"],
      ["sky-lanterns", "sky lanterns rising"],
      ["evening-star", "the evening star"],
    ]),
  },
  dua: {
    title: "The night courtyard",
    noun: "courtyard",
    base: "a courtyard under the night",
    act: "Write today's du'a",
    stages: stages([
      ["stars", "the first stars"],
      ["lamp", "a lamp in the arch"],
      ["fountain", "a fountain"],
      ["palm", "a date palm"],
      ["rug", "a prayer rug"],
      ["lamps", "lamps along the arcade"],
      ["jasmine", "jasmine on the wall"],
      ["water", "the fountain running"],
      ["dome", "a dome against the sky"],
      ["minaret", "a minaret"],
      ["lattice", "the star lattice in the windows"],
      ["crescent", "the crescent, risen"],
      ["milky-way", "the Milky Way"],
      ["fajr", "the first light of fajr"],
    ]),
  },
  reading: {
    title: "The reading nook",
    noun: "nook",
    base: "a quiet room with an empty shelf",
    act: "Read today",
    stages: stages([
      ["lamp", "a lamp, lit"],
      ["books", "the first books on the shelf"],
      ["armchair", "an armchair"],
      ["tea", "a cup of tea, steaming"],
      ["plant", "a plant on the sill"],
      ["rug", "a rug"],
      ["more-books", "more books, leaning"],
      ["moon", "the moon at the window"],
      ["cat", "a cat on the rug"],
      ["stack", "a stack of books by the chair"],
      ["print", "a framed print"],
      ["shelf", "a second shelf, full"],
      ["lights", "a string of lights"],
      ["fire", "the fire, lit"],
    ]),
  },
  wishes: {
    title: "The summit at sunrise",
    noun: "mountain",
    base: "a valley before dawn",
    act: "Rehearse a wish today",
    stages: stages([
      ["cairn", "a cairn at the trailhead"],
      ["path", "the path up the mountain"],
      ["tent", "a tent with a lamp"],
      ["trees", "pines along the path"],
      ["bridge", "a bridge over the ravine"],
      ["peak-light", "first light on the peak"],
      ["mist", "the mist lifting"],
      ["flag", "a waymark flag"],
      ["birds", "birds on the morning air"],
      ["lake", "a lake that holds the sky"],
      ["rose", "a rose sky"],
      ["flowers", "wildflowers on the ridge"],
      ["sun-rim", "the sun's rim"],
      ["sunrise", "sunrise at the summit"],
    ]),
  },
  disputations: {
    title: "The harbour after the storm",
    noun: "harbour",
    base: "a storm over the harbour",
    act: "Write or revisit one today",
    stages: stages([
      ["beam", "the lighthouse, lit"],
      ["rain-eases", "the rain easing"],
      ["waves", "the waves settling"],
      ["gap", "a gap in the cloud"],
      ["gull", "a gull"],
      ["rain-stops", "the rain stopping"],
      ["sunbreak", "the sun breaking through"],
      ["boat", "a boat heading out"],
      ["white-cloud", "the cloud thinning to white"],
      ["green", "the cliff turning green"],
      ["rainbow", "a rainbow"],
      ["cottage", "the keeper's cottage, smoke from the chimney"],
      ["glitter", "light on the water"],
      ["clear", "a clear sky"],
    ]),
  },
};

/** The stage ids showing at a level, in order. */
export function stageIdsAt(scene: Scene, level: number): string[] {
  return scene.stages.slice(0, Math.max(0, Math.min(TEND_DAYS, level))).map((stage) => stage.id);
}

/** Stage n (1-based), or null for the base. */
export function stageAt(scene: Scene, n: number): SceneStage | null {
  return n >= 1 && n <= scene.stages.length ? scene.stages[n - 1] : null;
}

/** Sentence case, for a name that starts a line. */
const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * What the scene card says: a title for where things stand, and one line
 * about today. Plain, and never a scolding: a missed day is just a day.
 */
export function sceneCaption(scene: Scene, tending: Tending): { title: string; line: string } {
  const { level, today, before, ifDone, ifSkipped } = tending;
  const title =
    level === TEND_DAYS
      ? `Fourteen days. The ${scene.noun} is whole.`
      : level === 0
        ? upper(scene.base)
        : `${level} of ${TEND_DAYS} days`;

  if (today) {
    if (level > before) {
      const brought = stageAt(scene, level);
      return { title, line: brought ? `Today brought ${brought.name}.` : "Today counted." };
    }
    const kept = stageAt(scene, level);
    return { title, line: kept ? `Today kept ${kept.name}.` : "Today counted." };
  }

  if (ifDone > level) {
    const coming = stageAt(scene, ifDone);
    return { title, line: coming ? `${scene.act} to bring ${coming.name}.` : `${scene.act}.` };
  }
  if (ifSkipped < level) {
    const atStake = stageAt(scene, level);
    return {
      title,
      line: atStake ? `${scene.act} to keep ${atStake.name}.` : `${scene.act}.`,
    };
  }
  return { title, line: `${scene.act} to keep it as it is.` };
}

/**
 * Daily recitation: the catalogue a person builds their set from, and the
 * arithmetic of a session.
 *
 * Plain module (no Prisma, no server-only), so the server page, the reader and
 * the logic check all agree. The words, the surah names and the hadith live in
 * the generated `recitation-texts.ts`, every field copied from a named source;
 * this file only says which recitations are on offer, in what parts, and how
 * many times each is said.
 *
 * The catalogue is Sahih only: every recitation carries at least one hadith
 * from al-Bukhari or Muslim, or one graded Sahih by al-Albani (with the other
 * graders shown). Default counts are the hadith's own where it names one;
 * otherwise once. Nothing is claimed for a recitation beyond its hadith.
 *
 * A recitation is made of parts read in order, and the whole is repeated
 * `rounds` times. Most have one part ("SubhanAllahi wa bihamdihi" said 100
 * times is one part, 100 rounds). The three Quls are three parts, Ikhlas then
 * Falaq then Nas, and saying them three times is three rounds of all three.
 * The tasbih after prayer is four parts with their own counts (33, 33, 33,
 * then the tahlil once) in a single round.
 */

import { COUNT_MAX, SET_MAX_ITEMS } from "./recitation-limits";
import {
  HADITH,
  SURAHS,
  TEXTS,
  TEXT_SOURCES,
  type Hadith,
  type TextKey,
  type TextSource,
  type Verse,
} from "./recitation-texts";

export type { Hadith, TextSource, Verse } from "./recitation-texts";
export { BISMILLAH } from "./recitation-texts";

export type RecitationGroup = "quran" | "adhkar" | "dua" | "salawat";

/** When its hadith places it. A tag, never a rule. */
export type RecitationTime = "morning" | "evening" | "both" | "night" | "prayer" | "any";

export type RecitationPart = {
  /** Shown above the words when an item has more than one part: "Al-Ikhlas". */
  title?: string;
  /** Open with the bismillah: a whole surah from its start. */
  bismillah?: boolean;
  /** Times this part is said within one round. */
  count: number;
  text: TextKey;
};

export type Recitation = {
  id: keyof typeof HADITH;
  title: string;
  /** The surah's Arabic name, from quran.com; none for adhkar. */
  arabicTitle: string;
  group: RecitationGroup;
  when: RecitationTime;
  /** Rounds by default: the hadith's own count, or once. */
  defaultCount: number;
  /** "Al-Baqarah 2:255", "Sahih al-Bukhari 6306". */
  ref: string;
  /** How the app counts it, if that needs saying. */
  note?: string;
  parts: readonly RecitationPart[];
};

const one = (text: TextKey, extra: Partial<RecitationPart> = {}): RecitationPart[] => [{ count: 1, text, ...extra }];
const surah = (n: 1 | 2 | 18 | 109 | 112 | 113 | 114) => SURAHS[String(n) as keyof typeof SURAHS];

export const RECITATIONS: readonly Recitation[] = [
  // ---------------------------------------------------------------- Quran
  {
    id: "quls",
    title: "The three Quls",
    arabicTitle: `${surah(112).arabic} · ${surah(113).arabic} · ${surah(114).arabic}`,
    group: "quran",
    when: "night",
    defaultCount: 3,
    ref: "Surahs 112, 113 and 114",
    note: "Al-Ikhlas, al-Falaq and an-Nas in turn; the three together count as once.",
    parts: [
      { title: surah(112).name, bismillah: true, count: 1, text: "ikhlas" },
      { title: surah(113).name, bismillah: true, count: 1, text: "falaq" },
      { title: surah(114).name, bismillah: true, count: 1, text: "nas" },
    ],
  },
  {
    id: "kursi",
    title: "Ayat al-Kursi",
    arabicTitle: surah(2).arabic,
    group: "quran",
    when: "night",
    defaultCount: 1,
    ref: "Al-Baqarah 2:255",
    parts: one("kursi"),
  },
  {
    id: "baqarah-end",
    title: "Last two verses of al-Baqarah",
    arabicTitle: surah(2).arabic,
    group: "quran",
    when: "night",
    defaultCount: 1,
    ref: "Al-Baqarah 2:285–286",
    parts: one("baqarah-end"),
  },
  {
    id: "fatiha",
    title: "Surah al-Fatihah",
    arabicTitle: surah(1).arabic,
    group: "quran",
    when: "any",
    defaultCount: 1,
    ref: "Surah 1",
    parts: one("fatiha"),
  },
  {
    id: "ikhlas",
    title: "Surah al-Ikhlas",
    arabicTitle: surah(112).arabic,
    group: "quran",
    when: "any",
    defaultCount: 1,
    ref: "Surah 112",
    parts: one("ikhlas", { bismillah: true }),
  },
  {
    id: "kahf-ten",
    title: "First ten verses of al-Kahf",
    arabicTitle: surah(18).arabic,
    group: "quran",
    when: "any",
    defaultCount: 1,
    ref: "Al-Kahf 18:1–10",
    parts: one("kahf-ten", { bismillah: true }),
  },
  {
    id: "kafirun",
    title: "Surah al-Kafirun",
    arabicTitle: surah(109).arabic,
    group: "quran",
    when: "night",
    defaultCount: 1,
    ref: "Surah 109",
    parts: one("kafirun", { bismillah: true }),
  },

  // ---------------------------------------------------------------- remembrance
  {
    id: "sayyid-istighfar",
    title: "Sayyid al-Istighfar",
    arabicTitle: "",
    group: "adhkar",
    when: "both",
    defaultCount: 1,
    ref: "Sahih al-Bukhari 6306",
    parts: one("sayyid-istighfar"),
  },
  {
    id: "subhanallah-100",
    title: "SubhanAllahi wa bihamdihi",
    arabicTitle: "",
    group: "adhkar",
    when: "both",
    defaultCount: 100,
    ref: "Sahih Muslim 2692",
    parts: one("subhanallah-100"),
  },
  {
    id: "subhanallahil-azim",
    title: "SubhanAllahi wa bihamdihi, SubhanAllahil-'Azim",
    arabicTitle: "",
    group: "adhkar",
    when: "any",
    defaultCount: 1,
    ref: "Sahih al-Bukhari 7563",
    parts: one("subhanallahil-azim"),
  },
  {
    id: "tahlil-10",
    title: "La ilaha illallahu wahdahu",
    arabicTitle: "",
    group: "adhkar",
    when: "any",
    defaultCount: 10,
    ref: "Sahih al-Bukhari 6403–6404",
    parts: one("tahlil-10"),
  },
  {
    id: "la-hawla",
    title: "La hawla wa la quwwata illa billah",
    arabicTitle: "",
    group: "adhkar",
    when: "any",
    defaultCount: 1,
    ref: "Sahih al-Bukhari 6384",
    parts: one("la-hawla"),
  },
  {
    id: "bismillah-protection",
    title: "Bismillahil-ladhi la yadurru",
    arabicTitle: "",
    group: "adhkar",
    when: "both",
    defaultCount: 3,
    ref: "Sunan Abi Dawud 5088",
    parts: one("bismillah-protection"),
  },
  {
    id: "kalimat-tammat",
    title: "A'udhu bi kalimatillahit-tammat",
    arabicTitle: "",
    group: "adhkar",
    when: "any",
    defaultCount: 1,
    ref: "Sahih Muslim 2708",
    parts: one("kalimat-tammat"),
  },
  {
    id: "subhanallah-adada",
    title: "SubhanAllahi wa bihamdihi 'adada khalqihi",
    arabicTitle: "",
    group: "adhkar",
    when: "morning",
    defaultCount: 3,
    ref: "Sahih Muslim 2726",
    parts: one("subhanallah-adada"),
  },
  {
    id: "istighfar",
    title: "Astaghfirullaha wa atubu ilayh",
    arabicTitle: "",
    group: "adhkar",
    when: "any",
    defaultCount: 100,
    ref: "Sahih al-Bukhari 6307 · Sahih Muslim 2702",
    parts: one("istighfar"),
  },
  {
    id: "afw-afiyah",
    title: "Asking for pardon and well-being",
    arabicTitle: "",
    group: "adhkar",
    when: "both",
    defaultCount: 1,
    ref: "Sunan Ibn Majah 3871",
    parts: one("afw-afiyah"),
  },
  {
    id: "bika-asbahna",
    title: "Allahumma bika asbahna",
    arabicTitle: "",
    group: "adhkar",
    when: "morning",
    defaultCount: 1,
    ref: "Sunan Abi Dawud 5068",
    parts: one("bika-asbahna"),
  },
  {
    id: "tasbih",
    title: "Tasbih after prayer",
    arabicTitle: "",
    group: "adhkar",
    when: "prayer",
    defaultCount: 1,
    ref: "Sahih Muslim 597",
    note: "SubhanAllah, alhamdulillah and Allahu akbar thirty-three times each, then the tahlil once to complete a hundred.",
    parts: [
      { title: "SubhanAllah", count: 33, text: "tasbih-subhanallah" },
      { title: "Alhamdulillah", count: 33, text: "tasbih-alhamdulillah" },
      { title: "Allahu akbar", count: 33, text: "tasbih-allahuakbar" },
      { title: "La ilaha illallah", count: 1, text: "tasbih-tahlil" },
    ],
  },

  // ---------------------------------------------------------------- Prophetic du'as
  {
    id: "unbeneficial-knowledge",
    title: "Refuge from unbeneficial knowledge, sloth & purifying the soul",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sahih Muslim 2722",
    parts: one("unbeneficial-knowledge"),
  },
  {
    id: "worry-and-grief",
    title: "Refuge from worry, grief, laziness & debt",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sahih al-Bukhari 6369",
    parts: one("worry-and-grief"),
  },
  {
    id: "guidance-piety-chastity",
    title: "Asking for guidance, piety, chastity & freedom from want",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sahih Muslim 2721",
    parts: one("guidance-piety-chastity"),
  },
  {
    id: "set-right-religion",
    title: "Setting right religion, worldly life & the Hereafter",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sahih Muslim 2720",
    parts: one("set-right-religion"),
  },
  {
    id: "steadfast-heart",
    title: "Steadfastness of the heart upon Your religion",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Jami' at-Tirmidhi 3522",
    parts: one("steadfast-heart"),
  },
  {
    id: "turn-hearts-obedience",
    title: "Turning our hearts to Your obedience",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sahih Muslim 2655",
    parts: one("turn-hearts-obedience"),
  },
  {
    id: "dhikr-shukr-ibadah",
    title: "Help in remembrance, thanks & good worship",
    arabicTitle: "",
    group: "dua",
    when: "prayer",
    defaultCount: 1,
    ref: "Sunan Abi Dawud 1522",
    parts: one("dhikr-shukr-ibadah"),
  },
  {
    id: "good-in-both-worlds",
    title: "Good in this world and the Hereafter",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sahih al-Bukhari 6389 · Sahih Muslim 2690",
    parts: one("good-in-both-worlds"),
  },
  {
    id: "withdrawal-of-blessing",
    title: "Refuge from the withdrawal of blessing & protection",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sahih Muslim 2739",
    parts: one("withdrawal-of-blessing"),
  },
  {
    id: "all-good-and-refuge",
    title: "Asking for all good & refuge from all evil",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sunan Ibn Majah 3846",
    parts: one("all-good-and-refuge"),
  },
  {
    id: "pardon-mercy-sustenance",
    title: "Pardon, mercy, guidance, protection & sustenance",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sahih Muslim 2697",
    parts: one("pardon-mercy-sustenance"),
  },
  {
    id: "abu-bakr-forgiveness",
    title: "Abu Bakr's du'a for forgiveness & mercy",
    arabicTitle: "",
    group: "dua",
    when: "prayer",
    defaultCount: 1,
    ref: "Sahih al-Bukhari 834 · Sahih Muslim 2705",
    parts: one("abu-bakr-forgiveness"),
  },
  {
    id: "forgive-all-sins",
    title: "Forgiveness of all faults, private & public",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sahih Muslim 2719 · Sahih al-Bukhari 6398",
    parts: one("forgive-all-sins"),
  },
  {
    id: "guidance-and-straightness",
    title: "Guidance & adhering to the straight path",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sahih Muslim 2725",
    parts: one("guidance-and-straightness"),
  },
  {
    id: "evil-done-and-undone",
    title: "Refuge from the evil of what I have done & not done",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sahih Muslim 2716",
    parts: one("evil-done-and-undone"),
  },
  {
    id: "evil-character-desires",
    title: "Refuge from evil character, actions & desires",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Jami' at-Tirmidhi 3591",
    parts: one("evil-character-desires"),
  },
  {
    id: "poverty-and-wrong",
    title: "Refuge from poverty, lack, abasement & wronging",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sunan Abi Dawud 1544",
    parts: one("poverty-and-wrong"),
  },
  {
    id: "refuge-four-trials",
    title: "Refuge from Hell, the grave, life, death & the Dajjal",
    arabicTitle: "",
    group: "dua",
    when: "prayer",
    defaultCount: 1,
    ref: "Sahih Muslim 588 · Sahih al-Bukhari 1377",
    parts: one("refuge-four-trials"),
  },
  {
    id: "dua-of-distress",
    title: "Supplication at a time of distress",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Sahih Muslim 2730 · Sahih al-Bukhari 6346",
    parts: one("dua-of-distress"),
  },
  {
    id: "dua-of-yunus",
    title: "Supplication of Dhun-Nun (Prophet Yunus)",
    arabicTitle: "",
    group: "dua",
    when: "any",
    defaultCount: 1,
    ref: "Jami' at-Tirmidhi 3505",
    parts: one("dua-of-yunus"),
  },
  {
    id: "beneficial-knowledge-provision",
    title: "Beneficial knowledge, goodly provision & acceptable deeds",
    arabicTitle: "",
    group: "dua",
    when: "morning",
    defaultCount: 1,
    ref: "Sunan Ibn Majah 925",
    parts: one("beneficial-knowledge-provision"),
  },
  {
    id: "light-in-heart",
    title: "Asking for light in the heart and every direction",
    arabicTitle: "",
    group: "dua",
    when: "night",
    defaultCount: 1,
    ref: "Sahih Muslim 763",
    parts: one("light-in-heart"),
  },
  {
    id: "asking-for-pardon",
    title: "Asking Allah for forgiveness (al-'Afuww)",
    arabicTitle: "",
    group: "dua",
    when: "night",
    defaultCount: 1,
    ref: "Sunan Ibn Majah 3850",
    parts: one("asking-for-pardon"),
  },

  // ---------------------------------------------------------------- salawat
  {
    id: "salat-ibrahimiyya",
    title: "As-Salat al-Ibrahimiyya",
    arabicTitle: "",
    group: "salawat",
    when: "any",
    defaultCount: 1,
    ref: "Sahih al-Bukhari 3370",
    parts: one("salat-ibrahimiyya"),
  },
];

/** The hadith for a recitation: why it's said. */
export function hadithFor(id: string): readonly Hadith[] {
  return (HADITH as Record<string, readonly Hadith[]>)[id] ?? [];
}

/** Where each of a part's three fields comes from. */
export function sourcesFor(text: TextKey): TextSource {
  return TEXT_SOURCES[text];
}

export const RECITATION_GROUPS: readonly { id: RecitationGroup; title: string; shortTitle: string }[] = [
  { id: "quran", title: "From the Quran", shortTitle: "Quran" },
  { id: "adhkar", title: "Remembrance", shortTitle: "Remembrance" },
  { id: "dua", title: "Prophetic du'as", shortTitle: "Prophetic du'as" },
  { id: "salawat", title: "Blessings on the Prophet ﷺ", shortTitle: "Blessings" },
];

export const TIME_LABEL: Record<RecitationTime, string> = {
  morning: "Morning",
  evening: "Evening",
  both: "Morning & evening",
  night: "Night",
  prayer: "After prayer",
  any: "Any time",
};

/**
 * Does a catalogue entry match a search string? Checks title, reference, time
 * tag, and the actual Arabic, transliteration and verbatim English translation
 * so searching a phrase from any du'a finds it immediately.
 */
export function recitationMatchesQuery(item: Recitation, query: string): boolean {
  const raw = query.trim();
  if (!raw) return true;
  const needle = raw.toLowerCase();
  if (
    item.title.toLowerCase().includes(needle) ||
    item.arabicTitle.includes(raw) ||
    item.ref.toLowerCase().includes(needle) ||
    TIME_LABEL[item.when].toLowerCase().includes(needle)
  ) {
    return true;
  }
  return item.parts.some((part) =>
    TEXTS[part.text].some(
      (verse) =>
        verse.en.toLowerCase().includes(needle) ||
        verse.tr.toLowerCase().includes(needle) ||
        verse.ar.includes(raw),
    ),
  );
}

const BY_ID = new Map<string, Recitation>(RECITATIONS.map((item) => [item.id, item]));

export function findRecitation(id: string): Recitation | undefined {
  return BY_ID.get(id);
}

/** The three you asked to always be on offer, and the set a new person starts with. */
export const REQUIRED_IDS = ["quls", "kursi", "baqarah-end"] as const;

// ---------------------------------------------------------------- the set

/** "custom:<id>" for a recitation you wrote yourself. */
export const CUSTOM_PREFIX = "custom:";

export type SetItem = { key: string; count: number };

export { COUNT_MAX, SET_MAX_ITEMS } from "./recitation-limits";

export const DEFAULT_SET: readonly SetItem[] = REQUIRED_IDS.map((id) => ({
  key: id,
  count: findRecitation(id)!.defaultCount,
}));

/**
 * A stored set, cleaned: unknown catalogue ids and custom ids that are no
 * longer yours drop out, counts are clamped, duplicates keep the first. An
 * empty or missing set is the default one.
 */
export function readSet(raw: unknown, customIds: ReadonlySet<string> = new Set()): SetItem[] {
  if (!Array.isArray(raw)) return [...DEFAULT_SET];
  const seen = new Set<string>();
  const out: SetItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { key, count } = entry as { key?: unknown; count?: unknown };
    if (typeof key !== "string" || seen.has(key)) continue;
    const known = key.startsWith(CUSTOM_PREFIX)
      ? customIds.has(key.slice(CUSTOM_PREFIX.length))
      : BY_ID.has(key);
    if (!known) continue;
    seen.add(key);
    const n = Math.round(Number(count));
    out.push({ key, count: Number.isFinite(n) ? Math.min(COUNT_MAX, Math.max(1, n)) : 1 });
    if (out.length === SET_MAX_ITEMS) break;
  }
  return out.length > 0 ? out : [...DEFAULT_SET];
}

// ---------------------------------------------------------------- a session

/** What the reader shows: one recitation, its words, its parts and rounds. */
export type SessionItem = {
  key: string;
  title: string;
  arabicTitle: string;
  ref: string;
  note?: string;
  /** When its hadith places it; none for your own. */
  when?: RecitationTime;
  /** Why it's said: its hadith. None for your own. */
  hadith: readonly Hadith[];
  rounds: number;
  parts: {
    title?: string;
    bismillah?: boolean;
    count: number;
    verses: readonly Verse[];
    /** Where the Arabic, transliteration and translation come from. */
    sources?: TextSource;
    /** Quran text: its ayah ornaments are in the words. */
    quran?: boolean;
  }[];
};

export function sessionItem(item: SetItem): SessionItem | null {
  const recitation = findRecitation(item.key);
  if (!recitation) return null;
  return {
    key: item.key,
    title: recitation.title,
    arabicTitle: recitation.arabicTitle,
    ref: recitation.ref,
    note: recitation.note,
    when: recitation.when,
    hadith: hadithFor(recitation.id),
    rounds: item.count,
    parts: recitation.parts.map((part) => ({
      title: part.title,
      bismillah: part.bismillah,
      count: part.count,
      verses: TEXTS[part.text],
      sources: TEXT_SOURCES[part.text],
      quran: recitation.group === "quran",
    })),
  };
}

/** Every tap the item takes: rounds times the parts' counts. */
export function itemTotal(item: Pick<SessionItem, "rounds" | "parts">): number {
  return item.rounds * item.parts.reduce((sum, part) => sum + part.count, 0);
}

/**
 * Where `taps` taps have got to inside one item: which round, which part, and
 * how far into that part. At or past the total it reports done, on the last
 * part of the last round.
 */
export function positionIn(
  item: Pick<SessionItem, "rounds" | "parts">,
  taps: number,
): { round: number; part: number; inPart: number; done: boolean } {
  const perRound = item.parts.reduce((sum, part) => sum + part.count, 0);
  const total = item.rounds * perRound;
  if (perRound === 0 || taps >= total) {
    return { round: item.rounds, part: item.parts.length - 1, inPart: item.parts.at(-1)?.count ?? 0, done: true };
  }
  const t = Math.max(0, taps);
  const round = Math.floor(t / perRound) + 1;
  let rest = t % perRound;
  let part = 0;
  while (rest >= item.parts[part].count) {
    rest -= item.parts[part].count;
    part += 1;
  }
  return { round, part, inPart: rest, done: false };
}

/** The opening words, for a card's one-line preview. */
export function previewArabic(item: SessionItem): string {
  return item.parts[0]?.verses[0]?.ar ?? "";
}

/** Arabic-Indic digits for verse markers: 12 -> "١٢". */
export function arabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

import { Amiri_Quran, Caveat, JetBrains_Mono, Karla, Newsreader } from "next/font/google";
import localFont from "next/font/local";

/** Display face — headings and the task title on the timer. Used with restraint. */
export const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

/** Body face — everything you read. */
export const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  display: "swap",
});

/** Every numeral: timer digits, durations, counts. */
export const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

/** Handwriting — journal note bodies and spread page headers only. */
export const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Arabic, for the daily recitation: the IndoPak (Naskh-Nastaleeq) style of
 * the South Asian mushaf, by Digital Khatt (Amine Anane, Tarteel), under the
 * SIL Open Font License 1.1 (lib/font-files/DigitalKhattIndoPak-OFL.txt).
 * It is made for the IndoPak script the Quran text uses, ayah ornaments and
 * all. Not preloaded, so no other page pays for it.
 */
export const indopak = localFont({
  src: "./font-files/DigitalKhattIndoPak.woff2",
  variable: "--font-indopak",
  display: "swap",
  preload: false,
});

/** The fallback for the few marks the IndoPak font doesn't carry (the Arabic comma). */
export const amiriQuran = Amiri_Quran({
  variable: "--font-amiri-quran",
  subsets: ["arabic"],
  weight: "400",
  display: "swap",
  preload: false,
});

export const fontVariables = `${newsreader.variable} ${karla.variable} ${jetbrainsMono.variable} ${caveat.variable} ${indopak.variable} ${amiriQuran.variable}`;

import { Caveat, JetBrains_Mono, Karla, Newsreader } from "next/font/google";

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

export const fontVariables = `${newsreader.variable} ${karla.variable} ${jetbrainsMono.variable} ${caveat.variable}`;

import { notFound } from "next/navigation";

import { ScenePreview } from "./scene-preview";

export const metadata = { title: "Scenes" };

/**
 * Every Mind scene at every level, for checking the drawings. Development
 * only: in production this route doesn't exist.
 */
export default function ScenesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ScenePreview />;
}

-- One bar, not two: the smallest version that counts, plus an un-metered log.
--
-- Order is load-bearing. Every backfill reads a column this migration drops,
-- so the drops come last.

-- 1. New columns first, so the backfills have somewhere to write.
ALTER TABLE "HabitRecurrence" ADD COLUMN "minimalTask" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TaskOccurrence" ADD COLUMN "minimalTaskDone" BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill the bar from the old minimum: "Once", "1 minute", "5 times".
--    Placeholder phrasing on purpose — the number is what the old bar said.
--    The form invites a named act instead ("Do the warmup").
UPDATE "HabitRecurrence"
SET "minimalTask" = CASE
  WHEN "unit" = 'MINUTES' AND "minimumQuota" = 1 THEN '1 minute'
  WHEN "unit" = 'MINUTES' THEN "minimumQuota"::text || ' minutes'
  WHEN "minimumQuota" = 1 THEN 'Once'
  ELSE "minimumQuota"::text || ' times'
END;

-- 3. A day that cleared either old bar claimed the minimal task. Recorded
--    even where a feedback note still gates DONE — the act happened; the
--    note is a separate gate and keeps its own meaning.
UPDATE "TaskOccurrence"
SET "minimalTaskDone" = true
WHERE "tier" IN ('MINIMUM', 'OPTIMAL');

-- 4. Shrink the old progress figure to what was logged past the bar, so
--    "went beyond" is `progress > 0` in every era. A tick-only day booked
--    exactly the minimum and becomes 0; a 25-minute day on a 2-minute bar
--    becomes 23. The true clock total stays in "loggedSeconds".
UPDATE "TaskOccurrence" o
SET "progress" = GREATEST(0, o."progress" - r."minimumQuota")
FROM "HabitRecurrence" r
WHERE o."taskId" = r."taskId"
  AND o."progress" > 0;

-- 5. Now the two bars and the tier can go.
ALTER TABLE "HabitRecurrence"
  DROP COLUMN "minimumQuota",
  DROP COLUMN "optimalQuota";
ALTER TABLE "TaskOccurrence" DROP COLUMN "tier";
DROP TYPE "QuotaTier";

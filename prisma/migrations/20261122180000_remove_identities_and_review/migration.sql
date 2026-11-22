-- DropForeignKey
ALTER TABLE "DayLog" DROP CONSTRAINT IF EXISTS "DayLog_leadIdentityId_fkey";

-- DropForeignKey
ALTER TABLE "TimeBlock" DROP CONSTRAINT IF EXISTS "TimeBlock_identityId_fkey";

-- DropForeignKey
ALTER TABLE "ShadowPattern" DROP CONSTRAINT IF EXISTS "ShadowPattern_identityId_fkey";

-- DropForeignKey
ALTER TABLE "HabitIdentity" DROP CONSTRAINT IF EXISTS "HabitIdentity_taskId_fkey";

-- DropForeignKey
ALTER TABLE "HabitIdentity" DROP CONSTRAINT IF EXISTS "HabitIdentity_identityId_fkey";

-- DropForeignKey
ALTER TABLE "WeeklyReview" DROP CONSTRAINT IF EXISTS "WeeklyReview_userId_fkey";

-- DropForeignKey
ALTER TABLE "WeeklyReview" DROP CONSTRAINT IF EXISTS "WeeklyReview_leadIdentityId_fkey";

-- DropForeignKey
ALTER TABLE "Identity" DROP CONSTRAINT IF EXISTS "Identity_userId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "TimeBlock_identityId_idx";

-- AlterTable
ALTER TABLE "DayLog" DROP COLUMN IF EXISTS "leadIdentityId";

-- AlterTable
ALTER TABLE "TimeBlock" DROP COLUMN IF EXISTS "identityId";

-- AlterTable
ALTER TABLE "ShadowPattern" DROP COLUMN IF EXISTS "identityId";

-- DropTable
DROP TABLE IF EXISTS "HabitIdentity";

-- DropTable
DROP TABLE IF EXISTS "WeeklyReview";

-- DropTable
DROP TABLE IF EXISTS "Identity";

-- DropEnum
DROP TYPE IF EXISTS "IdentityKind";

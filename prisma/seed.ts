/**
 * Development seed.
 *
 * Creates a demo user with projects, todos, habits and ~45 days of back-dated
 * sessions, so /stats and the habit grids have something real to render before
 * you've used the app for a month.
 *
 * Run with `pnpm db:seed`. Pass CLERK_USER_ID=user_xxx to attach the data to
 * your own Clerk account instead of the placeholder demo one.
 */

import "dotenv/config";

import { PrismaNeon } from "@prisma/adapter-neon";

import { ensureGlobalCategories } from "@/lib/budget";
import { tierFor, type Quota } from "@/lib/quota";
import { PrismaClient } from "../lib/generated/prisma/client";
import type {
  BodyPart,
  ExerciseEquipment,
  ExerciseDifficulty,
  ExerciseGoal,
  ExerciseType,
  TimerMode,
} from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const CLERK_ID = process.env.CLERK_USER_ID ?? "user_seed_demo";
const TIMEZONE = process.env.SEED_TIMEZONE ?? "UTC";
const DAYS_OF_HISTORY = 45;

const MS_PER_DAY = 86_400_000;

function localDate(offsetDays: number): Date {
  const now = new Date();
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(
    new Date(`${iso}T00:00:00.000Z`).getTime() + offsetDays * MS_PER_DAY,
  );
}

/** Deterministic pseudo-random, so re-seeding produces the same story. */
let seed = 42;
function random(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

/**
 * The exercise catalog — global content, seeded once, same for every person.
 * Every entry is researched from physio/PT sources for the postural patterns
 * a desk builds: anterior pelvic tilt (lower cross: stretch hip flexors,
 * strengthen glutes + deep core), rounded shoulders (upper cross: stretch
 * chest, strengthen upper back) and forward head (stretch the tight upper
 * traps/levator, strengthen the deep neck flexors). Also includes the calf
 * and forearm/wrist releases a desk shortens. Upserted by name so re-seeding
 * updates instead of duplicating.
 *
 * Every entry carries a `type` — STRENGTH, MOBILITY or FLOW — the shape the
 * body is doing, kept separate from `goal` because a goal name can't tell a
 * hold from a stretch (HAMSTRING_LENGTH names both a fold and a deadlift).
 * The routine generator composes days from `type`, so a day is never three
 * stretches wearing a workout's clothes.
 *
 * Every entry also carries a `difficulty` — EASY, MODERATE or HARD. A gentle
 * routine ("easy exercises only") draws strictly from the easy pool, so its
 * ratings are assigned with pool coverage in mind: every type × equipment
 * corner has at least one easy exercise to draw from.
 */
const EXERCISES: Array<{
  name: string;
  equipment: ExerciseEquipment;
  goal: ExerciseGoal;
  type: ExerciseType;
  difficulty: ExerciseDifficulty;
  bodyParts: BodyPart[];
  instructions: string[];
  prescription: string;
}> = [
  // ------------------------------------------------ yoga — anterior pelvic tilt
  {
    name: "Bridge Pose",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "GLUTE_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["GLUTES", "HAMSTRINGS", "LOWER_BACK"],
    instructions: [
      "Lie on your back, knees bent, feet flat and hip-width apart, heels close enough to touch with your fingertips.",
      "Press through your heels and lift your hips until your body forms a straight line from shoulders to knees.",
      "Lengthen your tailbone toward your knees — keep the lower back neutral, don't arch it. Squeeze your glutes firmly at the top.",
      "Hold for two counts, then lower slowly with control. Drag your heels toward your shoulders to feel it in the glutes, not the lower back.",
    ],
    prescription: "Hold 30–60s · 3 rounds",
  },
  {
    name: "Low Lunge (Anjaneyasana)",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "HIP_FLEXOR_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["HIP_FLEXORS", "QUADS", "GLUTES"],
    instructions: [
      "From a lunge, drop the back knee to the mat, toes untucked.",
      "The single most important move for anterior pelvic tilt: lengthen your tailbone down and draw the lower belly in — resist the urge to sink into the lower back.",
      "Press the back glute forward and down until you feel the stretch at the front of the back thigh.",
      "Lift your ribs out of your waist and keep the spine tall; roll the shoulders down and back.",
    ],
    prescription: "Hold 60–90s per side",
  },
  {
    name: "Pelvic Tilts",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "POSTURE_AWARENESS",
    type: "MOBILITY",
    bodyParts: ["CORE", "LOWER_BACK"],
    instructions: [
      "Lie on your back, knees bent, feet flat. Rest your palms on your upper thighs.",
      "Flatten your lower back toward the mat by drawing your belly button in — press your hands into your thighs as you do, lengthening the lower back.",
      "Release and let the back arch gently again, then repeat. Move slowly and deliberately.",
      "This is motor control: you're learning to find and hold the neutral point, not lifting anything.",
    ],
    prescription: "10–15 slow reps",
  },
  {
    name: "Cat–Cow",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "LOWER_BACK_RELIEF",
    type: "MOBILITY",
    bodyParts: ["SPINE", "CORE", "LOWER_BACK"],
    instructions: [
      "Start on hands and knees, wrists under shoulders, knees under hips.",
      "Inhale into Cow: arch the back, roll the shoulders back and away from the ears. Don't drop deeply into the backbend — keep the pelvis neutral so you don't feed the tilt.",
      "Exhale into Cat: round the spine to the ceiling, draw the abs in, tuck the chin.",
      "Move with your breath, building awareness of pelvic and spinal mobility.",
    ],
    prescription: "8–10 breath rounds",
  },
  {
    name: "Bird Dog",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "CORE_STABILITY",
    type: "STRENGTH",
    bodyParts: ["CORE", "GLUTES", "LOWER_BACK"],
    instructions: [
      "Start on hands and knees, back flat and neutral.",
      "Extend the right arm forward and the left leg back in one line, without letting the hips tilt or the lower back sag.",
      "Squeeze the glute of the extended leg and hold for 5–10 seconds, breathing.",
      "Lower, switch sides, and continue alternating.",
    ],
    prescription: "10 reps per side · 5–10s hold",
  },
  {
    name: "Locust Pose",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "UPPER_BACK_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["GLUTES", "HAMSTRINGS", "UPPER_BACK", "LOWER_BACK"],
    instructions: [
      "Lie on your belly, legs together, arms by your sides with palms facing in.",
      "Lift the chest, arms and legs off the mat together — but not by cranking the lower back.",
      "Squeeze the glutes and draw the shoulder blades down and together. Focus on the mid and upper back doing the lifting.",
      "Hold, breathe, lower with control. Only come as high as you can without compressing the lumbar spine.",
    ],
    prescription: "Hold 30s · 3 rounds",
  },
  {
    name: "Boat Pose",
    difficulty: "HARD",
    equipment: "YOGA",
    goal: "CORE_STABILITY",
    type: "STRENGTH",
    bodyParts: ["CORE", "HIP_FLEXORS"],
    instructions: [
      "Sit tall, knees bent, feet flat. Lean back slightly and lift the feet so shins are parallel to the floor.",
      "Draw the lower belly in and lift the chest — engage the deep abs, don't let the lower back round.",
      "Reach the arms forward parallel to the floor, palms up, and hold.",
      "Straighten the legs only if you can keep the pelvis stable; keep breathing.",
    ],
    prescription: "Hold 20–30s · 3 rounds",
  },
  {
    name: "Reclined Spinal Twist",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "LOWER_BACK_RELIEF",
    type: "MOBILITY",
    bodyParts: ["LOWER_BACK", "SPINE"],
    instructions: [
      "Lie on your back, arms out to a T, palms up.",
      "Draw the knees to the chest, then let both knees fall to the left, keeping both shoulders on the mat.",
      "Turn your gaze the opposite way. Feel the twist release through the lower back and hips.",
      "Keep the shoulders down — don't force the knees; let gravity do the work.",
    ],
    prescription: "Hold 45–60s per side",
  },
  {
    name: "Child's Pose",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "LOWER_BACK_RELIEF",
    type: "MOBILITY",
    bodyParts: ["LOWER_BACK", "HIP_FLEXORS", "SHOULDERS"],
    instructions: [
      "From hands and knees, sit back toward your heels and walk the hands forward.",
      "Rest the forehead on the mat and soften the jaw, letting the spine and lower back lengthen.",
      "Breathe into the back of the body — a genuine rest pose, not a stretch to push.",
      "Wider knees are fine if the hips are tight.",
    ],
    prescription: "Hold 60–90s",
  },
  {
    name: "Standing Forward Fold",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "HAMSTRING_LENGTH",
    type: "MOBILITY",
    bodyParts: ["HAMSTRINGS", "LOWER_BACK"],
    instructions: [
      "Stand tall, feet hip-width apart, soft knees.",
      "Hinge at the hips and fold forward, letting the head hang heavy.",
      "Keep a micro-bend in the knees — feel the length in the hamstrings, not the strain in the lower back.",
      "Let the arms dangle; on each exhale, soften a little deeper.",
    ],
    prescription: "Hold 45–60s",
  },
  {
    name: "Downward-Facing Dog",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "HAMSTRING_LENGTH",
    type: "MOBILITY",
    bodyParts: ["SHOULDERS", "HAMSTRINGS", "UPPER_BACK"],
    instructions: [
      "From hands and knees, tuck the toes and lift the hips up and back.",
      "Press firmly through the hands and lengthen the spine from the tailbone to the crown — imagine a long diagonal line.",
      "Let the heels reach toward the mat without forcing; peddle the feet if the hamstrings are tight.",
      "Keep the shoulders rolling open and the neck long; hold for several breaths.",
    ],
    prescription: "Hold 45–60s",
  },
  {
    name: "Cobra Pose",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "UPPER_BACK_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["UPPER_BACK", "CHEST", "LOWER_BACK"],
    instructions: [
      "Lie on your belly, hands under your shoulders, elbows close to the body.",
      "Press into the palms and lift the chest — push the pubic bone and the tops of the feet into the mat so the lower back doesn't take the load.",
      "Come up only as high as you can with the hips staying down; think mid and upper back, not maximum height.",
      "Tuck the chin slightly to keep the neck long, then lower slowly.",
    ],
    prescription: "Hold 15–30s · 3 rounds",
  },

  // --------------------------------------------- yoga — posture (upper body)
  {
    name: "Thread the Needle",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "CHEST_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["UPPER_BACK", "SHOULDERS", "CHEST"],
    instructions: [
      "From hands and knees, slide the right arm underneath the body, palm up, right shoulder and ear lowering toward the mat.",
      "Keep the left hand planted; you can press it gently to deepen the rotation.",
      "Feel the stretch across the right shoulder, upper back and chest.",
      "Release slowly, return to tabletop, and switch sides.",
    ],
    prescription: "Hold 30–45s per side",
  },
  {
    name: "Puppy Pose",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "CHEST_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["CHEST", "SHOULDERS", "UPPER_BACK"],
    instructions: [
      "From hands and knees, walk the hands forward while keeping the hips stacked over the knees.",
      "Lower the chest toward the mat and rest the forehead down.",
      "Press the palms firmly and reach the tailbone back, feeling a deep stretch through the chest, shoulders and upper back.",
      "A powerful counter to a day of rounding forward; breathe into the chest.",
    ],
    prescription: "Hold 60s",
  },
  {
    name: "Cow Face Arms",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "CHEST_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["SHOULDERS", "UPPER_BACK", "CHEST"],
    instructions: [
      "Sit tall or kneel. Reach the right arm up, then bend the elbow and let the hand drop behind the upper back.",
      "Reach the left arm behind your back and up toward the right hand; clasp if they meet, otherwise hold a strap.",
      "Keep the ribs quiet and the chest open — don't lean forward to force it.",
      "Hold, breathe, and switch sides.",
    ],
    prescription: "Hold 30s per side",
  },
  {
    name: "Eagle Arms",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "UPPER_BACK_STRENGTH",
    type: "MOBILITY",
    bodyParts: ["SHOULDERS", "UPPER_BACK"],
    instructions: [
      "Stand tall. Cross the right arm over the left at the elbow, bend both elbows and bring the backs of the forearms together.",
      "Lift the elbows away from the body while drawing the shoulder blades down and back.",
      "Feel the release through the shoulders and the work between the shoulder blades.",
      "Hold, then unwind and repeat with the left arm crossed over.",
    ],
    prescription: "Hold 20–30s · 2 rounds per side",
  },

  // ----------------------------------------------- dumbbells — anterior pelvic tilt
  {
    name: "Dumbbell Glute Bridge",
    difficulty: "EASY",
    equipment: "DUMBBELL",
    goal: "GLUTE_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["GLUTES", "HAMSTRINGS", "CORE"],
    instructions: [
      "Lie on your back, knees bent, feet flat and hip-width apart. Rest a light dumbbell across your hip crease and hold it with both hands.",
      "Flatten the lower back into the floor first — the posterior tilt is the starting position, not something to skip.",
      "Drive through your heels and lift the hips to a straight line, squeezing the glutes hard at the top for a two-count.",
      "Lower under control without letting the lower back arch.",
    ],
    prescription: "3 × 12–15",
  },
  {
    name: "Single-Leg Dumbbell Glute Bridge",
    difficulty: "HARD",
    equipment: "DUMBBELL",
    goal: "GLUTE_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["GLUTES", "HAMSTRINGS", "CORE"],
    instructions: [
      "Lie on your back with one knee bent, foot flat. Extend the other leg straight or hover it above the floor.",
      "Rest a light dumbbell over the hip of the working leg.",
      "Press through the heel and lift the hips until level, keeping the pelvis square — don't let the dumbbell pull you out of alignment.",
      "Squeeze the glute at the top, lower slowly, and finish all reps on one side before switching.",
    ],
    prescription: "3 × 10–12 per side",
  },
  {
    name: "Dumbbell Hip Thrust",
    difficulty: "MODERATE",
    equipment: "DUMBBELL",
    goal: "GLUTE_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["GLUTES", "HAMSTRINGS"],
    instructions: [
      "Sit on the floor with your upper back against a bench, a light dumbbell across your hip crease.",
      "Plant both feet hip-width apart so the shins are close to vertical at the top.",
      "Brace the core, keep the ribs down, and drive through the heels to lift the hips until the torso and thighs form a line.",
      "Finish by squeezing the glutes — never by leaning back into the lower back. Pause, lower under control.",
    ],
    prescription: "3 × 12",
  },
  {
    name: "Dumbbell Romanian Deadlift",
    difficulty: "MODERATE",
    equipment: "DUMBBELL",
    goal: "HAMSTRING_LENGTH",
    type: "STRENGTH",
    bodyParts: ["HAMSTRINGS", "GLUTES", "LOWER_BACK"],
    instructions: [
      "Stand tall holding light dumbbells in front of your thighs, feet hip-width, soft knees.",
      "Push the hips back — as if closing a car door with your bum — keeping the spine neutral and ribs down.",
      "Lower the weights to mid-shin or until you feel a strong hamstring stretch, then drive through the heels and squeeze the glutes to stand.",
      "This is a hinge, not a squat: go slow, back flat, chest proud.",
    ],
    prescription: "3 × 10–12",
  },
  {
    name: "Goblet Squat",
    difficulty: "MODERATE",
    equipment: "DUMBBELL",
    goal: "GLUTE_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["GLUTES", "QUADS", "CORE"],
    instructions: [
      "Hold one light dumbbell at your chest, elbows tucked in.",
      "Feet shoulder-width or slightly wider; sit down between your hips, knees tracking over the toes.",
      "Keep the chest up and the pelvis neutral — the front-loaded weight teaches you what neutral pelvis under load feels like.",
      "Depth matters less than position: squat only as low as you can hold neutral, then push up through the heels.",
    ],
    prescription: "3 × 10–12",
  },
  {
    name: "Weighted Dead Bug",
    difficulty: "MODERATE",
    equipment: "DUMBBELL",
    goal: "CORE_STABILITY",
    type: "STRENGTH",
    bodyParts: ["CORE", "HIP_FLEXORS"],
    instructions: [
      "Lie on your back with arms extended over the chest, holding one light dumbbell with both hands.",
      "Knees bent to 90°, feet off the floor. Press the lower back flat — the posterior tilt is the part you hold.",
      "Slowly lower the opposite arm and leg toward the floor while the weight stays put, keeping the back flat the whole time.",
      "Return, alternate sides. The load makes the core work harder against arching — go slow.",
    ],
    prescription: "3 × 8–10 per side",
  },
  {
    name: "Standing Dumbbell Hip Extension",
    difficulty: "MODERATE",
    equipment: "DUMBBELL",
    goal: "GLUTE_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["GLUTES", "HAMSTRINGS"],
    instructions: [
      "Stand tall, one hand on a wall or chair for balance. Hold a light dumbbell in the crook of the opposite knee.",
      "Keeping the leg straight-ish and the pelvis level, squeeze the glute and extend the leg straight back.",
      "Don't lean forward or arch the lower back — the movement comes from the glute.",
      "Lower with control, finish the set, switch sides.",
    ],
    prescription: "3 × 12 per side",
  },
  {
    name: "Dumbbell Reverse Lunge",
    difficulty: "MODERATE",
    equipment: "DUMBBELL",
    goal: "GLUTE_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["GLUTES", "QUADS", "CORE"],
    instructions: [
      "Stand tall, light dumbbells at your sides.",
      "Step one foot back and lower until both knees reach about 90°, the front shin vertical.",
      "Keep the chest tall and the pelvis neutral — squeeze the front glute as you drive back up through the front heel.",
      "Alternate legs, moving slowly enough that balance isn't the limiting factor.",
    ],
    prescription: "3 × 10 per side",
  },
  {
    name: "Farmer's Carry",
    difficulty: "MODERATE",
    equipment: "DUMBBELL",
    goal: "POSTURE_AWARENESS",
    type: "STRENGTH",
    bodyParts: ["FULL_BODY", "CORE", "SHOULDERS"],
    instructions: [
      "Hold a light dumbbell in each hand, arms long, shoulders relaxed down and back.",
      "Stand tall with a neutral spine and gently engaged glutes — walk slowly and deliberately.",
      "Breathe and keep the ribs stacked over the hips; this is posture under load.",
      "Walk for the time prescribed, then rest.",
    ],
    prescription: "3 × 30–45s",
  },

  // ------------------------------------------------ dumbbells — posture (upper body)
  {
    name: "Bent-Over Dumbbell Row",
    difficulty: "MODERATE",
    equipment: "DUMBBELL",
    goal: "UPPER_BACK_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["UPPER_BACK", "SHOULDERS"],
    instructions: [
      "Hinge forward from the hips to roughly 45°, back straight, core engaged, light dumbbells hanging down.",
      "Draw the weights toward your lower ribs by squeezing the shoulder blades together.",
      "Pause briefly at the top, then lower under control — no swinging, no momentum.",
      "This builds the upper back muscles that pull the shoulders back and support the spine.",
    ],
    prescription: "3 × 10–12",
  },
  {
    name: "Single-Arm Dumbbell Row",
    difficulty: "MODERATE",
    equipment: "DUMBBELL",
    goal: "UPPER_BACK_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["UPPER_BACK", "CORE"],
    instructions: [
      "Place one hand and the same-side knee on a bench, back flat, neck neutral.",
      "Let the working arm hang with a light dumbbell, palm facing in.",
      "Pull the weight up toward your hip, focusing on squeezing the shoulder blade.",
      "Lower slowly and finish all reps before switching sides. Working one side at a time also challenges the core to keep you stable.",
    ],
    prescription: "3 × 10–12 per side",
  },
  {
    name: "Dumbbell Reverse Fly",
    difficulty: "MODERATE",
    equipment: "DUMBBELL",
    goal: "UPPER_BACK_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["UPPER_BACK", "SHOULDERS"],
    instructions: [
      "Hinge forward at the hips with a long, flat back, soft knees, light dumbbells hanging straight down, palms facing each other.",
      "Raise both arms out to the sides with a soft bend in the elbows, squeezing the shoulder blades toward the spine.",
      "Pause at the top, then lower slowly. Chin tucked, neck long.",
      "Light weights only — if you swing or shrug, it's too heavy.",
    ],
    prescription: "3 × 12–15",
  },
  {
    name: "Prone Y Raise",
    difficulty: "EASY",
    equipment: "DUMBBELL",
    goal: "UPPER_BACK_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["UPPER_BACK", "SHOULDERS"],
    instructions: [
      "Lie face down, arms extended overhead in a Y, thumbs pointing up, very light dumbbells (or none at all).",
      "Lift the arms a few inches off the floor by squeezing the lower shoulder blades down and back — not by shrugging the neck.",
      "Hold a beat at the top, then lower slowly.",
      "This targets the lower traps, the muscle that keeps the shoulder blades anchored down.",
    ],
    prescription: "3 × 10",
  },
  {
    name: "Prone T Raise",
    difficulty: "EASY",
    equipment: "DUMBBELL",
    goal: "UPPER_BACK_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["UPPER_BACK", "SHOULDERS"],
    instructions: [
      "Lie face down, arms out to the sides in a T, palms down, very light dumbbells.",
      "Lift the arms a few inches, squeezing the shoulder blades together — the mid traps and rhomboids.",
      "Keep the neck relaxed and the gaze toward the floor.",
      "Hold a beat at the top, lower slowly, repeat.",
    ],
    prescription: "3 × 10",
  },
  {
    name: "Dumbbell YTW",
    difficulty: "MODERATE",
    equipment: "DUMBBELL",
    goal: "UPPER_BACK_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["UPPER_BACK", "SHOULDERS"],
    instructions: [
      "Hinge forward to about 45° with light dumbbells, arms hanging below your chest.",
      "Y: raise both arms forward and up to form a Y at ear level, thumbs up, squeezing the shoulder blades.",
      "T: arms out to the sides at shoulder height, palms down, drawing the blades down and back.",
      "W: bend the elbows and pull the weights to your ribs, then rotate the hands up to a W. One Y, T, W counts as one rep — this is precision work, keep it light and slow.",
    ],
    prescription: "3 × 8–10 per letter",
  },
  {
    name: "Dumbbell Pullover",
    difficulty: "EASY",
    equipment: "DUMBBELL",
    goal: "CHEST_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["CHEST", "FULL_BODY", "CORE"],
    instructions: [
      "Lie on your back (bench or floor), knees bent. Hold one light dumbbell with both hands over your chest.",
      "With soft elbows, lower the weight back and overhead toward the floor, feeling a stretch through the chest and ribs.",
      "Keep the ribs down and the lower back neutral — the stretch is in the chest, not the spine.",
      "Pull back up to the start, keeping the movement controlled throughout.",
    ],
    prescription: "3 × 10–12",
  },

  // ------------------------------------------------------ yoga — neck (forward head)
  {
    name: "Chin Tucks",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "NECK_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["NECK"],
    instructions: [
      "Sit or stand tall, eyes level, shoulders relaxed down.",
      "Draw your chin straight back — not down — as if making a double chin, keeping your gaze forward.",
      "Hold the tucked position for 5 seconds, breathing normally, then release slowly.",
      "The head should glide back over the spine; if it tilts up or down, make it smaller.",
    ],
    prescription: "10 slow reps · hold 5s",
  },
  {
    name: "Deep Neck Flexor Hold",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "NECK_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["NECK"],
    instructions: [
      "Lie on your back, knees bent, head resting on the mat.",
      "Tuck your chin gently, then lift your head barely off the mat — a centimetre or two — without letting the chin poke forward.",
      "Hold with the deep neck muscles, not the jaw or the big surface muscles.",
      "Lower slowly. Build time gradually; a long neck beats a high head.",
    ],
    prescription: "Hold 10–20s · 5 reps",
  },
  {
    name: "Upper Trapezius Stretch",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "NECK_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["NECK", "SHOULDERS"],
    instructions: [
      "Sit or stand tall, one hand resting lightly at the base of your skull.",
      "Gently tip your ear toward the same-side shoulder, letting the opposite shoulder drop away.",
      "Use the hand only for a light nudge — let gravity do the work, and keep the chest open.",
      "Hold, breathe into the side of the neck, and switch sides.",
    ],
    prescription: "Hold 30s per side",
  },
  {
    name: "Levator Scapulae Stretch",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "NECK_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["NECK", "UPPER_BACK"],
    instructions: [
      "Sit tall and turn your nose toward one armpit, then drop the chin down and in.",
      "Rest the same-side hand lightly on the back of your head — no pulling.",
      "Feel the stretch along the back of the neck, near the top of the shoulder blade.",
      "Hold, then release slowly and switch sides.",
    ],
    prescription: "Hold 30s per side",
  },

  // ------------------------------------------------------ yoga — calves & forearms
  {
    name: "Standing Calf Stretch",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "CALF_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["CALVES"],
    instructions: [
      "Stand facing a wall, one leg back, heel pressed to the floor, toes pointing straight ahead.",
      "Keep the back leg straight and lean your body toward the wall until you feel the calf stretch.",
      "Hold without bouncing; press through the heel to deepen.",
      "Switch legs.",
    ],
    prescription: "Hold 45–60s per side",
  },
  {
    name: "Wall Soleus Stretch",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "CALF_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["CALVES"],
    instructions: [
      "Stand close to a wall, one foot back, and bend both knees slightly.",
      "Keep the back heel down and let that knee drift forward over the toes.",
      "The bend is what targets the deep calf (soleus) rather than the big gastrocnemius.",
      "Hold, breathe, switch sides.",
    ],
    prescription: "Hold 45–60s per side",
  },
  {
    name: "Wrist Extensor Stretch",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "WRIST_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["FOREARMS"],
    instructions: [
      "Extend one arm straight in front of you, palm down.",
      "Use the other hand to gently pull the fingers down and back toward you.",
      "Keep the elbow straight and the shoulder relaxed; feel the stretch across the top of the forearm.",
      "Hold, then switch arms.",
    ],
    prescription: "Hold 30–45s per side",
  },
  {
    name: "Wrist Flexor Stretch",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "WRIST_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["FOREARMS"],
    instructions: [
      "Extend one arm straight in front of you, palm up.",
      "Use the other hand to gently pull the fingers down toward the floor.",
      "Keep the elbow straight; feel the stretch along the underside of the forearm.",
      "Hold, then switch arms.",
    ],
    prescription: "Hold 30–45s per side",
  },

  // ------------------------------------------------------ yoga — leg strength
  {
    name: "Chair Pose",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "LEG_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["QUADS", "GLUTES", "CORE", "UPPER_BACK"],
    instructions: [
      "Stand with feet hip-width apart. Bend the knees and sit the hips back and down as if lowering into a chair behind you.",
      "Shift the weight into the heels — you should be able to wiggle your toes. Keep the knees tracking over the middle toes.",
      "Lengthen the tailbone down and draw the lower ribs in; do not let the lower back arch to lift the chest.",
      "Reach the arms forward or overhead, shoulders down. Breathe steadily — the legs should be burning by the end.",
    ],
    prescription: "Hold 45–60s · 3 rounds",
  },
  {
    name: "Warrior II",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "LEG_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["QUADS", "GLUTES", "ADDUCTORS", "SHOULDERS"],
    instructions: [
      "Step the feet wide apart. Turn the right foot out 90° and angle the left foot slightly in; align the right heel with the left arch.",
      "Bend the right knee toward 90°, knee stacked over the ankle and tracking toward the little toe — never collapsing inward.",
      "Keep the torso stacked directly over the hips, not leaning forward. Tailbone down, ribs quiet.",
      "Extend the arms parallel to the floor, gaze over the front hand. Actively press the back foot's outer edge into the mat.",
    ],
    prescription: "Hold 45–60s per side",
  },
  {
    name: "High Lunge",
    difficulty: "HARD",
    equipment: "YOGA",
    goal: "LEG_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["QUADS", "GLUTES", "HIP_FLEXORS", "CORE"],
    instructions: [
      "From standing, step one foot far back, ball of the foot down, back leg straight and strong.",
      "Bend the front knee to roughly 90°, shin vertical, weight even between both legs.",
      "Draw the back hip forward so the pelvis is square, then lengthen the tailbone down — this is where the back hip flexor gets both stretched and loaded.",
      "Reach the arms overhead or keep hands at the hips. Hold with the legs working, not by resting into the joints.",
    ],
    prescription: "Hold 30–45s per side · 2 rounds",
  },
  {
    name: "Garland Pose (Malasana)",
    difficulty: "HARD",
    equipment: "YOGA",
    goal: "ANKLE_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["ANKLES", "ADDUCTORS", "GLUTES", "LOWER_BACK"],
    instructions: [
      "Stand with feet slightly wider than hip-width, toes turned out a little. Squat all the way down, hips below the knees.",
      "Bring the palms together at the chest and press the elbows lightly against the inner knees to open the hips.",
      "Work the heels toward the floor — sit on a folded blanket or a book under the heels if they lift.",
      "Lift the chest and lengthen the spine. This is the deep squat position most desk-bound people lose entirely.",
    ],
    prescription: "Hold 60–90s",
  },

  // ----------------------------------------------------- yoga — push strength
  {
    name: "Plank",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "PUSH_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["CORE", "SHOULDERS", "CHEST", "GLUTES"],
    instructions: [
      "From hands and knees, step the feet back so the body forms one straight line from heels to crown.",
      "Stack the shoulders directly over the wrists and push the floor away — the upper back should feel broad, not sunken between the blades.",
      "Squeeze the glutes and tuck the tailbone slightly so the hips neither sag nor pike up.",
      "Breathe normally throughout. Drop to the knees the moment the lower back starts to dip — a shorter clean hold beats a long sagging one.",
    ],
    prescription: "Hold 45–60s · 3 rounds",
  },
  {
    name: "Side Plank",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "CORE_STABILITY",
    type: "STRENGTH",
    bodyParts: ["CORE", "SHOULDERS", "GLUTES"],
    instructions: [
      "Lie on one side, then prop up on the forearm (elbow under the shoulder) or the straight arm, feet stacked or staggered.",
      "Lift the hips until the body is one straight line from ankle to head — no sagging at the waist.",
      "Press the bottom shoulder down and away from the ear; reach the top arm to the ceiling or rest it on the hip.",
      "Drop the bottom knee to the mat for an easier version. This trains the side of the core, which nothing else in your library covers.",
    ],
    prescription: "Hold 30–45s per side · 2 rounds",
  },
  {
    name: "Chaturanga Hold",
    difficulty: "HARD",
    equipment: "YOGA",
    goal: "PUSH_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["CHEST", "SHOULDERS", "ARMS", "CORE"],
    instructions: [
      "From plank, shift slightly forward onto the toes, then bend the elbows and lower until the upper arms are roughly parallel to the floor.",
      "Keep the elbows hugging in over the wrists — never flaring wide — and the shoulders no lower than elbow height.",
      "Hold the line: glutes engaged, ribs down, gaze slightly forward.",
      "Knees down is a legitimate version and better than a collapsed full one. Lower to the mat with control when the hold ends.",
    ],
    prescription: "Hold 10–20s · 4 rounds",
  },
  {
    name: "Dolphin Pose",
    difficulty: "HARD",
    equipment: "YOGA",
    goal: "PUSH_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["SHOULDERS", "UPPER_BACK", "CORE", "HAMSTRINGS"],
    instructions: [
      "From hands and knees, lower to the forearms, elbows under the shoulders, forearms parallel.",
      "Tuck the toes and lift the hips up and back into an inverted V, pressing the forearms firmly down.",
      "Draw the shoulder blades down the back and let the head hang free between the arms — do not shrug up toward the ears.",
      "Keep the knees bent if the hamstrings pull the spine round. Wrist-friendly alternative to Downward Dog, and far stronger for the shoulders.",
    ],
    prescription: "Hold 30–45s · 3 rounds",
  },

  // ------------------------------------------------------------- yoga — balance
  {
    name: "Tree Pose",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "BALANCE",
    type: "STRENGTH",
    bodyParts: ["GLUTES", "CALVES", "CORE", "ANKLES"],
    instructions: [
      "Stand tall and shift the weight into the left foot, spreading the toes and gripping the mat lightly.",
      "Place the right foot on the inner calf or inner thigh — never on the side of the knee. Press foot and leg into each other.",
      "Level the hips and lengthen the tailbone down; it is tempting to let the standing hip jut out to the side.",
      "Hands at the chest or overhead. Fix the gaze on a still point. Wobbling is the work, not a failure.",
    ],
    prescription: "Hold 45–60s per side",
  },
  {
    name: "Warrior III",
    difficulty: "HARD",
    equipment: "YOGA",
    goal: "BALANCE",
    type: "STRENGTH",
    bodyParts: ["GLUTES", "HAMSTRINGS", "CORE", "UPPER_BACK"],
    instructions: [
      "From standing, shift onto the right foot with a soft knee, hands at the chest.",
      "Hinge forward from the hip as the left leg lifts behind you, until torso and leg form one line parallel to the floor.",
      "Keep the lifted hip level with the standing hip — square the pelvis down toward the mat rather than letting it roll open.",
      "Flex the lifted foot and press back through the heel. Squeeze the standing glute hard; that muscle is holding you up.",
    ],
    prescription: "Hold 20–30s per side · 2 rounds",
  },

  // -------------------------------------------------- yoga — hips (side & deep)
  {
    name: "Side-Lying Leg Raise",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "GLUTE_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["GLUTES", "CORE"],
    instructions: [
      "Lie on one side, body in a straight line, head resting on the lower arm, top hand on the floor for balance.",
      "Rotate the top leg very slightly inward (toes angled toward the floor) — this targets the side glute rather than the hip flexor.",
      "Lift the top leg to about 45° without letting the hips roll back. Pause at the top.",
      "Lower slowly over three counts. Small and precise beats high and swinging.",
    ],
    prescription: "12–15 reps per side · 2 rounds",
  },
  {
    name: "Wide-Legged Forward Fold",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "HIP_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["ADDUCTORS", "HAMSTRINGS", "LOWER_BACK"],
    instructions: [
      "Step the feet wide, outer edges parallel, toes pointing straight ahead.",
      "Hinge from the hips with a long spine and fold forward, hands to the floor or a block.",
      "Keep the weight slightly forward in the feet and the knees soft; feel the stretch through the inner thighs and hamstrings.",
      "Let the head hang heavy and soften a little more on each exhale.",
    ],
    prescription: "Hold 60s",
  },

  // -------------------------------------------------- yoga — calves & cardio
  {
    name: "Standing Calf Raise",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "CALF_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["CALVES", "ANKLES"],
    instructions: [
      "Stand tall, feet hip-width, fingertips on a wall for balance only — not for support.",
      "Rise onto the balls of the feet as high as you can, keeping the weight even across all the toes rather than rolling to the outer edge.",
      "Pause for a full second at the top, then lower over three slow counts until the heels touch.",
      "Progress by moving to one leg at a time once 20 slow reps feel easy.",
    ],
    prescription: "15–20 slow reps · 3 rounds",
  },
  {
    name: "Sun Salutation Flow",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "CARDIO",
    type: "FLOW",
    bodyParts: ["FULL_BODY", "SHOULDERS", "HAMSTRINGS", "CORE"],
    instructions: [
      "Cycle continuously: Mountain → forward fold → half lift → plank → lower down → Cobra → Downward Dog → step forward → rise.",
      "Move one breath per movement and do not pause between rounds — continuity is the entire point of this one.",
      "Aim for a pace where breathing is noticeably harder but you could still speak a short sentence.",
      "This is the only genuinely aerobic item in the library. Build from 8 minutes toward 15.",
    ],
    prescription: "10–15 min continuous",
  },
  {
    name: "Bridge March",
    difficulty: "MODERATE",
    equipment: "YOGA",
    goal: "GLUTE_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["GLUTES", "HAMSTRINGS", "CORE"],
    instructions: [
      "Set up and lift into Bridge Pose, hips high, glutes squeezed, lower back neutral.",
      "Without dropping the hips, lift one foot a few centimetres off the mat, holding for two counts.",
      "Lower it and lift the other. The pelvis should not dip or rotate at any point — that stability is the exercise.",
      "Keep the ribs down and breathe. Progression from the static Bridge you already have.",
    ],
    prescription: "8–10 per side · 2 rounds",
  },

  // ------------------------------------------ yoga — the gentle week's floor
  // The easy pool a gentle routine draws from: floor-based release work, a
  // wall-supported strength pair, and one flow that never touches the mat.
  // Every entry is doable on a first week or a sore day.
  {
    name: "Legs-Up-the-Wall",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "LOWER_BACK_RELIEF",
    type: "MOBILITY",
    bodyParts: ["LOWER_BACK", "HAMSTRINGS"],
    instructions: [
      "Sit sideways against a wall, hip touching it. In one movement, swing the legs up the wall as you lie back.",
      "Rest the arms out to the sides, palms up, and let the shoulders and hips settle into the floor.",
      "Heels resting on the wall, knees soft. Let the lower back flatten — gravity drains the legs after a day of sitting.",
      "Stay quiet and breathe. This is decompression, not a stretch to push.",
    ],
    prescription: "Hold 2–5 min",
  },
  {
    name: "Supine Figure-4 Stretch",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "HIP_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["GLUTES", "LOWER_BACK"],
    instructions: [
      "Lie on your back, knees bent, feet flat. Cross the right ankle over the left knee and flex the right foot.",
      "Thread the hands behind the left thigh and draw it gently toward the chest.",
      "Keep the head and shoulders on the mat — the stretch lands in the right glute and deep hip, not the neck.",
      "Hold and breathe, then switch sides.",
    ],
    prescription: "Hold 45–60s per side",
  },
  {
    name: "Happy Baby",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "HIP_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["ADDUCTORS", "GLUTES", "LOWER_BACK"],
    instructions: [
      "Lie on your back. Draw the knees toward the chest, then let them fall wide toward the armpits.",
      "Reach inside the knees and take hold of the outer edges of the feet — or the backs of the thighs if the feet are out of reach.",
      "Flex the feet and gently pull the knees down toward the floor alongside the ribs. Keep the tailbone heavy on the mat.",
      "Rock gently side to side if it feels good. Effortless is the point.",
    ],
    prescription: "Hold 60–90s",
  },
  {
    name: "Wall Angels",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "POSTURE_AWARENESS",
    type: "MOBILITY",
    bodyParts: ["UPPER_BACK", "SHOULDERS", "CHEST"],
    instructions: [
      "Stand with your back against a wall, feet a small step out, knees soft. Rest the back of the head, the upper back and the tailbone gently on the wall.",
      "Bend the elbows and place the backs of the forearms and hands on the wall, like a goalpost.",
      "Slowly slide the arms up and over, then back down, keeping the knuckles and forearms in contact with the wall wherever they reach.",
      "Contact matters more than range — where the arms leave the wall is the tight spot. Keep the ribs down; don't arch the lower back to fake it.",
    ],
    prescription: "8–10 slow reps",
  },
  {
    name: "Ankle Circles & Pumps",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "ANKLE_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["ANKLES", "CALVES"],
    instructions: [
      "Sit on the floor with the legs extended, hands resting behind you for support.",
      "Circle the feet at the ankles — ten slow circles each direction, drawing the biggest circle the ankle allows.",
      "Then pump: pull the toes toward the shin, then point them away, slow and full.",
      "Keep the knees still the whole time; all the movement is at the ankle. Sitting steals this range quietly.",
    ],
    prescription: "10 circles each direction · 10 pumps per foot",
  },
  {
    name: "Wall Push-Up",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "PUSH_STRENGTH",
    type: "STRENGTH",
    bodyParts: ["CHEST", "SHOULDERS", "ARMS", "CORE"],
    instructions: [
      "Stand an arm's length from a wall, palms on the wall at shoulder height and width.",
      "Keep the body in one straight line — glutes on, heels down — as you bend the elbows and bring the chest toward the wall.",
      "Elbows track back at roughly 45°, not flaring wide.",
      "Press away until the arms are straight. Deliberately easier than a floor push-up; step the feet further back when it stops being work.",
    ],
    prescription: "2 × 10–12",
  },
  {
    name: "Gentle Morning Flow",
    difficulty: "EASY",
    equipment: "YOGA",
    goal: "CARDIO",
    type: "FLOW",
    bodyParts: ["FULL_BODY", "SPINE", "SHOULDERS"],
    instructions: [
      "A slow continuous sequence, one breath per movement: Mountain → reach up → forward fold → half lift → flat back.",
      "Roll up through the spine to standing and begin again. No plank, no lowering to the floor.",
      "Keep the pace conversational — the aim is to move the spine and warm the joints, not to raise the heart rate.",
      "Continue without pausing for the time prescribed. Continuity, not intensity.",
    ],
    prescription: "5–10 min continuous",
  },
  {
    name: "Standing Dumbbell Chest Opener",
    difficulty: "EASY",
    equipment: "DUMBBELL",
    goal: "CHEST_MOBILITY",
    type: "MOBILITY",
    bodyParts: ["CHEST", "SHOULDERS"],
    instructions: [
      "Stand tall, feet hip-width, holding a light dumbbell in each hand at your sides.",
      "Raise both arms out to the sides to shoulder height, palms facing up.",
      "Squeeze the shoulder blades gently together and reach the chest up — feel the openness across the front of the shoulders.",
      "Hold for two slow breaths, then lower with control. The light weight makes the opening easier to hold, not harder.",
    ],
    prescription: "2 × 10 slow reps · hold 5s at the top",
  },
];

async function seedExercises() {
  await Promise.all(
    EXERCISES.map((exercise, index) =>
      prisma.exercise.upsert({
        where: { name: exercise.name },
        create: { ...exercise, sortOrder: index },
        update: { ...exercise },
      }),
    ),
  );
  console.log(`Exercises: ${EXERCISES.length} upserted`);
}

async function main() {
  console.log(`Seeding for clerkId=${CLERK_ID} in ${TIMEZONE}…`);

  await seedExercises();

  const user = await prisma.user.upsert({
    where: { clerkId: CLERK_ID },
    create: {
      clerkId: CLERK_ID,
      name: "Demo",
      email: "demo@example.com",
      timezone: TIMEZONE,
    },
    update: { timezone: TIMEZONE },
  });

  // Start from a clean slate so re-running doesn't pile up duplicates.
  await prisma.timeBlock.deleteMany({ where: { userId: user.id } });
  await prisma.focusSession.deleteMany({ where: { userId: user.id } });
  await prisma.taskOccurrence.deleteMany({ where: { userId: user.id } });
  await prisma.task.deleteMany({ where: { userId: user.id } });
  await prisma.project.deleteMany({ where: { userId: user.id } });
  await prisma.moneyBudget.deleteMany({ where: { userId: user.id } });
  await prisma.moneyTransaction.deleteMany({ where: { userId: user.id } });
  await prisma.accountTransfer.deleteMany({ where: { userId: user.id } });
  await prisma.moneyAccount.deleteMany({ where: { userId: user.id } });
  await prisma.moneyCategory.deleteMany({ where: { ownerKey: user.id } });

  // One default account, so every seeded entry has a place to sit — the same
  // "Main" the app creates on first run.
  const mainAccount = await prisma.moneyAccount.create({
    data: { userId: user.id, name: "Main", sortOrder: 0 },
  });

  const [deepWork, admin, home] = await Promise.all([
    prisma.project.create({
      data: { userId: user.id, name: "Deep work", color: "teal", sortOrder: 1 },
    }),
    prisma.project.create({
      data: { userId: user.id, name: "Admin", color: "sand", sortOrder: 2 },
    }),
    prisma.project.create({
      data: { userId: user.id, name: "Home", color: "sage", sortOrder: 3 },
    }),
  ]);

  const todos = await Promise.all(
    [
      {
        title: "Write the project proposal",
        projectId: deepWork.id,
        priority: "P1" as const,
        estimatedSeconds: 90 * 60,
        plannedIntervals: 4,
        dueDate: localDate(0),
        // The demo data has to demonstrate the point of steps, not just their
        // existence: step one is deliberately something you could not talk
        // yourself out of.
        steps: [
          {
            title: "Open last quarter's proposal and skim the headings",
            minutes: 2,
          },
          {
            title: "Write the one-sentence version of what we're asking for",
            minutes: 10,
          },
          { title: "Draft the background section badly", minutes: 30 },
          { title: "Put real numbers in the budget table", minutes: 25 },
          { title: "Read it back once and send it", minutes: 20 },
        ],
      },
      {
        title: "Review the pull request backlog",
        projectId: deepWork.id,
        priority: "P2" as const,
        estimatedSeconds: 45 * 60,
        plannedIntervals: 2,
        dueDate: localDate(0),
      },
      {
        title: "Email the landlord about the boiler",
        projectId: admin.id,
        priority: "P1" as const,
        estimatedSeconds: 10 * 60,
        defaultMode: "BASIC" as TimerMode,
        dueDate: localDate(-2),
      },
      {
        title: "Renew the car insurance",
        projectId: admin.id,
        priority: "P2" as const,
        estimatedSeconds: 20 * 60,
        defaultMode: "BASIC" as TimerMode,
        dueDate: localDate(-1),
      },
      {
        title: "Sort out the spare room",
        projectId: home.id,
        priority: "P3" as const,
        estimatedSeconds: 60 * 60,
        defaultMode: "FLOW" as TimerMode,
        steps: [
          { title: "Carry the empty boxes upstairs", minutes: 2 },
          { title: "Clear the desk surface", minutes: 15 },
          { title: "One bag for charity, one for the bin", minutes: 30 },
        ],
      },
      {
        title: "Book the dentist",
        projectId: admin.id,
        priority: "P3" as const,
        estimatedSeconds: 5 * 60,
        defaultMode: "BASIC" as TimerMode,
        dueDate: localDate(1),
      },
    ].map(({ steps, ...task }, index) =>
      prisma.task.create({
        data: {
          userId: user.id,
          type: "TODO",
          sortOrder: index,
          defaultMode: "POMODORO",
          ...task,
          steps: {
            create: (steps ?? []).map((step, position) => ({
              userId: user.id,
              title: step.title,
              position,
              estimatedSeconds: step.minutes * 60,
            })),
          },
        },
      }),
    ),
  );

  // A planned day, so the calendar isn't empty on first open — including a
  // buffer block and a recovery block, because a demo day that is wall-to-wall
  // work would teach exactly the wrong lesson.
  await prisma.timeBlock.createMany({
    data: [
      {
        userId: user.id,
        taskId: todos[0].id,
        title: todos[0].title,
        date: localDate(0),
        startMinute: 9 * 60,
        endMinute: 10 * 60 + 30,
        kind: "WORK" as const,
      },
      {
        userId: user.id,
        title: "Buffer",
        date: localDate(0),
        startMinute: 10 * 60 + 30,
        endMinute: 11 * 60,
        kind: "BUFFER" as const,
      },
      {
        userId: user.id,
        taskId: todos[1].id,
        title: todos[1].title,
        date: localDate(0),
        startMinute: 11 * 60,
        endMinute: 11 * 60 + 45,
        kind: "WORK" as const,
      },
      {
        userId: user.id,
        title: "Read something that isn't a screen",
        date: localDate(0),
        startMinute: 14 * 60,
        endMinute: 14 * 60 + 30,
        kind: "RECOVERY" as const,
      },
      {
        userId: user.id,
        taskId: todos[4].id,
        title: todos[4].title,
        date: localDate(1),
        startMinute: 10 * 60,
        endMinute: 11 * 60,
        kind: "WORK" as const,
      },
    ],
  });

  const habits = await Promise.all(
    [
      {
        title: "Morning pages",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        estimatedSeconds: 15 * 60,
        defaultMode: "BASIC" as TimerMode,
        reliability: 0.82,
        // Two minutes to count, fifteen on a good day. The gap between the two
        // is the point: it is what makes the streak survivable.
        unit: "MINUTES" as const,
        minimumQuota: 2,
        optimalQuota: 15,
      },
      {
        title: "Read something long",
        daysOfWeek: [1, 3, 5],
        estimatedSeconds: 30 * 60,
        defaultMode: "FLOW" as TimerMode,
        reliability: 0.65,
        unit: "COUNT" as const,
        minimumQuota: 1,
        optimalQuota: 10,
      },
      {
        title: "Inbox to zero",
        daysOfWeek: [1, 2, 3, 4, 5],
        estimatedSeconds: 20 * 60,
        defaultMode: "POMODORO" as TimerMode,
        reliability: 0.74,
        unit: "MINUTES" as const,
        minimumQuota: 5,
        optimalQuota: 20,
      },
      {
        title: "Stretch",
        daysOfWeek: [0, 2, 4, 6],
        estimatedSeconds: 10 * 60,
        defaultMode: "BASIC" as TimerMode,
        reliability: 0.5,
        // No stretch goal at all — one of the four, so the "no optimal" path
        // is exercised by the seed rather than only by tests.
        unit: "COUNT" as const,
        minimumQuota: 1,
        optimalQuota: null,
      },
    ].map(async (habit, index) => {
      const task = await prisma.task.create({
        data: {
          userId: user.id,
          type: "HABIT",
          title: habit.title,
          priority: "P3",
          sortOrder: index,
          estimatedSeconds: habit.estimatedSeconds,
          defaultMode: habit.defaultMode,
          recurrence: {
            create: {
              kind: habit.daysOfWeek.length === 7 ? "DAILY" : "SPECIFIC_DAYS",
              daysOfWeek: habit.daysOfWeek,
              startDate: localDate(-DAYS_OF_HISTORY),
              unit: habit.unit,
              minimumQuota: habit.minimumQuota,
              optimalQuota: habit.optimalQuota,
            },
          },
        },
      });
      return { task, ...habit };
    }),
  );

  // ---- back-dated history ------------------------------------------------

  let sessionCount = 0;

  for (let offset = -DAYS_OF_HISTORY; offset <= 0; offset += 1) {
    const date = localDate(offset);
    const weekday = date.getUTCDay();

    for (const habit of habits) {
      if (!habit.daysOfWeek.includes(weekday)) continue;
      // Today is left undone, so the app opens with something to do.
      if (offset === 0) continue;

      const roll = random();
      if (roll > habit.reliability) {
        if (roll > 0.94) {
          await prisma.taskOccurrence.create({
            data: {
              userId: user.id,
              taskId: habit.task.id,
              date,
              status: "SKIPPED",
            },
          });
        }
        continue;
      }

      const target = habit.estimatedSeconds;
      // Real sessions rarely land exactly on the estimate.
      const elapsed = Math.round(target * (0.75 + random() * 0.75));

      // A realistic spread of days: most clear the minimum, a good few go all
      // the way. Derived through `tierFor` rather than assigned, so the seed
      // can't invent a combination the app itself would never produce.
      const quota: Quota = {
        unit: habit.unit,
        minimum: habit.minimumQuota,
        optimal: habit.optimalQuota,
      };
      const ceiling = habit.optimalQuota ?? habit.minimumQuota;
      const progress =
        habit.unit === "MINUTES"
          ? Math.max(habit.minimumQuota, Math.round(elapsed / 60))
          : random() < 0.45
            ? ceiling + Math.floor(random() * 3)
            : habit.minimumQuota +
              Math.floor(random() * Math.max(1, ceiling - habit.minimumQuota));

      const occurrence = await prisma.taskOccurrence.create({
        data: {
          userId: user.id,
          taskId: habit.task.id,
          date,
          status: "DONE",
          completedAt: new Date(date.getTime() + 9 * 3600_000),
          loggedSeconds: elapsed,
          progress,
          tier: tierFor(progress, quota),
        },
      });

      await createSession({
        userId: user.id,
        taskId: habit.task.id,
        occurrenceId: occurrence.id,
        localDate: date,
        mode: habit.defaultMode,
        targetSeconds: target,
        elapsedSeconds: elapsed,
        hour: 7 + Math.floor(random() * 3),
      });
      sessionCount += 1;
    }

    // A few deep-work sessions on weekdays.
    if (weekday >= 1 && weekday <= 5 && offset < 0 && random() > 0.45) {
      const task = todos[Math.floor(random() * 2)];
      const target = task.estimatedSeconds ?? 1500;
      const elapsed = Math.round(target * (0.6 + random() * 0.9));

      const occurrence = await prisma.taskOccurrence.upsert({
        where: { taskId_date: { taskId: task.id, date } },
        create: {
          userId: user.id,
          taskId: task.id,
          date,
          status: "PENDING",
          loggedSeconds: elapsed,
        },
        update: { loggedSeconds: { increment: elapsed } },
      });

      await createSession({
        userId: user.id,
        taskId: task.id,
        occurrenceId: occurrence.id,
        localDate: date,
        mode: task.defaultMode,
        targetSeconds: target,
        elapsedSeconds: elapsed,
        hour: 10 + Math.floor(random() * 6),
      });
      sessionCount += 1;
    }
  }

  // ---- back-dated money, so the budget opens with a real ledger -----------

  await ensureGlobalCategories();

  const salary = await prisma.moneyCategory.findFirstOrThrow({
    where: { ownerKey: "global", name: "Salary" },
  });

  await Promise.all([
    prisma.moneyCategory.create({
      data: {
        ownerKey: user.id,
        userId: user.id,
        kind: "EXPENSE",
        name: "Coffee",
        color: "sand",
        sortOrder: 1,
      },
    }),
    prisma.moneyCategory.create({
      data: {
        ownerKey: user.id,
        userId: user.id,
        kind: "INCOME",
        name: "Bonus",
        color: "ink",
        sortOrder: 1,
      },
    }),
  ]);
  const bonus = await prisma.moneyCategory.findFirstOrThrow({
    where: { ownerKey: user.id, name: "Bonus" },
  });

  // Amounts are rupees in the source and paise in the ledger.
  const EXPENSE_POOL: {
    name: string;
    chance: number;
    min: number;
    max: number;
  }[] = [
    { name: "Food", chance: 0.9, min: 300, max: 900 },
    { name: "Groceries", chance: 0.35, min: 1200, max: 5000 },
    { name: "Transport", chance: 0.6, min: 150, max: 700 },
    { name: "Utilities", chance: 0.08, min: 8000, max: 15000 },
    { name: "Medical", chance: 0.05, min: 1500, max: 9000 },
    { name: "Shopping", chance: 0.18, min: 1200, max: 12000 },
    { name: "Entertainment", chance: 0.25, min: 400, max: 3000 },
    { name: "Subscriptions", chance: 0.14, min: 500, max: 4000 },
    { name: "Coffee", chance: 0.45, min: 150, max: 500 },
  ];

  const expenseCategories = await prisma.moneyCategory.findMany({
    where: { kind: "EXPENSE" },
  });

  let transactionCount = 0;

  // Today is left empty, so the app opens with something to do.
  for (let offset = -75; offset < 0; offset += 1) {
    const date = localDate(offset);

    // Payday, the first of every month — salary plus a plausible rent, and
    // sometimes a bonus on top.
    if (date.getUTCDate() === 1) {
      await prisma.moneyTransaction.create({
        data: {
          userId: user.id,
          accountId: mainAccount.id,
          categoryId: salary.id,
          amountCents: 200_000_00,
          date,
        },
      });
      transactionCount += 1;

      if (random() > 0.6) {
        await prisma.moneyTransaction.create({
          data: {
            userId: user.id,
            accountId: mainAccount.id,
            categoryId: bonus.id,
            amountCents: Math.round(15000 * (1 + random())) * 100,
            date,
          },
        });
        transactionCount += 1;
      }
    }

    // Two to six expenses a day, drawn with category-appropriate frequency.
    const expenseCount = 2 + Math.floor(random() * 5);
    for (let i = 0; i < expenseCount; i += 1) {
      const pick = EXPENSE_POOL[Math.floor(random() * EXPENSE_POOL.length)];
      if (random() > pick.chance) continue;

      const amountCents =
        Math.round(pick.min + random() * (pick.max - pick.min)) * 100;
      const category =
        expenseCategories.find((entry) => entry.name === pick.name) ??
        expenseCategories[0];

      await prisma.moneyTransaction.create({
        data: {
          userId: user.id,
          accountId: mainAccount.id,
          categoryId: category.id,
          amountCents,
          date,
        },
      });
      transactionCount += 1;
    }
  }

  // Two envelopes: one running right now, one that has already run — the
  // budget page's hero and its "ended" rows. A share of the expenses that
  // fall inside each window count against it, so the drill-in has something
  // to show.
  const budgets = await Promise.all([
    createBudget(user.id, "This week", 25_000_00, -2, 4),
    createBudget(user.id, "Shopping weekend", 18_000_00, -11, -7),
  ]);
  for (const budget of budgets) {
    const inRange = await prisma.moneyTransaction.findMany({
      where: {
        userId: user.id,
        date: {
          gte: budget.startsOn,
          lt: new Date(budget.endsOn.getTime() + MS_PER_DAY),
        },
        category: { kind: "EXPENSE" },
      },
      select: { id: true },
    });
    await Promise.all(
      inRange
        .filter(() => random() < 0.3)
        .map((transaction) =>
          prisma.moneyTransaction.update({
            where: { id: transaction.id },
            data: { budgetId: budget.id },
          }),
        ),
    );
  }

  console.log(
    `Done: ${todos.length} tasks, ${habits.length} habits, ${sessionCount} sessions, ${transactionCount} money entries.`,
  );
}

async function createBudget(
  userId: string,
  name: string,
  amountCents: number,
  startOffset: number,
  endOffset: number,
) {
  return prisma.moneyBudget.create({
    data: {
      userId,
      name,
      amountCents,
      startsOn: localDate(startOffset),
      endsOn: localDate(endOffset),
    },
  });
}

async function createSession(input: {
  userId: string;
  taskId: string;
  occurrenceId: string;
  localDate: Date;
  mode: TimerMode;
  targetSeconds: number;
  elapsedSeconds: number;
  hour: number;
}) {
  const startedAt = new Date(input.localDate.getTime() + input.hour * 3600_000);
  const endedAt = new Date(startedAt.getTime() + input.elapsedSeconds * 1000);
  const overtime = Math.max(0, input.elapsedSeconds - input.targetSeconds);

  await prisma.focusSession.create({
    data: {
      userId: input.userId,
      taskId: input.taskId,
      occurrenceId: input.occurrenceId,
      clientKey: `seed_${input.taskId}_${input.localDate.toISOString().slice(0, 10)}`,
      mode: input.mode,
      targetSeconds: input.targetSeconds,
      plannedIntervals: input.mode === "POMODORO" ? 2 : 1,
      focusSeconds: 1500,
      shortBreakSeconds: 300,
      longBreakSeconds: 900,
      status: "COMPLETED",
      startedAt,
      endedAt,
      runningSince: null,
      lastBeatAt: endedAt,
      accumulatedSeconds: input.elapsedSeconds,
      elapsedSeconds: input.elapsedSeconds,
      overtimeSeconds: overtime,
      reachedTargetAt: overtime > 0 ? endedAt : null,
      pausedCount: Math.floor(random() * 3),
      endReason: overtime > 0 ? "USER_STOPPED" : "TARGET_REACHED",
      localDate: input.localDate,
      intervals: {
        create: {
          index: 0,
          kind: "FOCUS",
          targetSeconds: input.targetSeconds,
          startedAt,
          endedAt,
          accumulatedSeconds: input.elapsedSeconds,
          elapsedSeconds: input.elapsedSeconds,
          overtimeSeconds: overtime,
          completed: input.elapsedSeconds >= input.targetSeconds,
        },
      },
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

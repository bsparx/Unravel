/** Client-safe: imported by dialogs that ask for the note, so no Prisma here. */
export const DEFAULT_FEEDBACK_PROMPT = "What did you get out of it?";

/**
 * The clamp on a feedback note. 500 chars is a short paragraph — enough for a
 * real reflection, short enough that the per-habit log stays scannable. The
 * dialogs show a live counter against this, and the server enforces the same
 * bound, so the cap reads as a clamp rather than a silent stop.
 */
export const MAX_FEEDBACK_LENGTH = 500;

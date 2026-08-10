/**
 * Which way round the learner is going.
 *
 * The app now carries two opposite sets of content for the same word:
 *
 *   english — a Thai speaker learning English. Wants `pronunciationTh` (the English word
 *             spelled in Thai) and English example sentences.
 *   thai    — an English speaker learning Thai. Wants `meaningThReading`,
 *             `meaningThRoman` and the letter-by-letter breakdown of `meaningTh`.
 *
 * Showing both to everyone doubles the card and leaves half of it irrelevant to whoever
 * is reading, so the mode picks a side.
 *
 * Direction is a course-level decision represented by the locale. It must not be a control
 * on every lesson card: that suggests learners should reconsider their course mid-session.
 */

export type LearnerMode = "english" | "thai";

/**
 * Resolve the course direction from the interface locale.
 */
export const resolveLearnerMode = (locale: string): LearnerMode => {
    return locale === "th" ? "english" : "thai";
};

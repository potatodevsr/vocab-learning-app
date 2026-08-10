/**
 * Lifecycle analytics — the typed, privacy-safe front door to GA4.
 *
 * `docs/LEARNER-LIFECYCLE.md` §7 defines a single event taxonomy and one hard privacy
 * rule: analytics carries a *pseudonymous* id, never the application `userId`, and never
 * email, typed answers, Thai meaning text or any auth/claim token. That id is the join
 * key to email and to every progress row in D1, so exporting it to a third-party
 * processor would de-anonymise everything else that was kept anonymous.
 *
 * This module is the only place product code emits events. It enforces the taxonomy at
 * the type level and the privacy rule at runtime: a property that is not on the
 * allow-list is dropped before anything reaches `gtag`, so a future caller cannot leak a
 * field by accident. Server completion events remain the source of truth for learning and
 * reward metrics (§7.1); these client events measure rendering and interaction only.
 *
 * L0 scope: the transitions the *current* baseline can actually observe — public page
 * views, the existing signup, and the existing lesson session. The rest of the taxonomy
 * is declared so later slices wire into the same guard rather than inventing their own.
 */

import type { CefrLevel } from "@/lib/types";
import type { LearnerMode } from "@/lib/learner-mode";

/**
 * The full lifecycle taxonomy (`docs/LEARNER-LIFECYCLE.md` §7.1). Declaring every name
 * here — not only the ones L0 fires — keeps later slices honest: a typo becomes a compile
 * error rather than a silently-dropped event.
 */
export const LIFECYCLE_EVENTS = [
    "public_page_viewed",
    "public_answer_played",
    "trial_started",
    "trial_answered",
    "trial_completed",
    "signup_started",
    "signup_completed",
    "placement_started",
    "placement_completed",
    "session_started",
    "answer_submitted",
    "session_completed",
    "unit_completed",
    "level_completed",
    "course_completed",
    "review_started",
    "goal_changed",
    "reminder_opted_in",
    "return_after_absence",
] as const;

export type LifecycleEvent = (typeof LIFECYCLE_EVENTS)[number];

/** Which public template the visitor arrived on (`docs/LEARNER-LIFECYCLE.md` §3.1). */
export type AcquisitionFamily =
    | "home"
    | "word"
    | "unit"
    | "level"
    | "topic"
    | "guide"
    | "comparison"
    | "alphabet"
    | "other";

/** The kind of session an interaction/completion event belongs to. `"mixed"` is the
 *  merged eight-item session (LEARNER-LIFECYCLE.md §3.5, §8 L2) that replaced lesson→quiz. */
export type SessionKind = "lesson" | "quiz" | "review" | "trial" | "placement" | "mixed";

/** The mixed session's item variants (`backend/src/session.ts`'s `ITEM_TYPE_SCHEDULE`) —
 *  a closed set so this dimension can never carry anything but a known variant name. */
export const ITEM_TYPES = [
    "choose-meaning",
    "choose-word",
    "spelling",
    "match-pairs",
    "speed-round",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/**
 * The interface locales the app actually ships (`i18n/routing.ts`). A closed union, not
 * `string`, so a stray `en-US` from a misconfigured browser cannot ride along as a new
 * dimension GA has never seen.
 */
export const LOCALES = ["en", "th"] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * A constrained outcome label. Never free-form or learner-authored text — see
 * {@link LifecycleProps.outcome}.
 */
export const OUTCOMES = ["known", "review", "completed"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/**
 * The only experiments this build knows how to run (`docs/LEARNER-LIFECYCLE.md` §7.3
 * "first candidates"). Closed, like {@link Outcome}: an experiment id is a dimension in
 * GA reports, and an unreviewed id sneaking through would silently start a new report
 * bucket nobody predeclared a hypothesis or guardrail for.
 */
export const EXPERIMENTS = [
    "word_cta_specificity",
    "trial_length_5_vs_7",
    "trial_immediate_vs_choice",
    "comeback_batch_size",
] as const;
export type Experiment = (typeof EXPERIMENTS)[number];

/** Which public template families we accept at runtime (mirrors {@link AcquisitionFamily}). */
const ACQUISITION_FAMILIES: ReadonlySet<AcquisitionFamily> = new Set([
    "home",
    "word",
    "unit",
    "level",
    "topic",
    "guide",
    "comparison",
    "alphabet",
    "other",
]);

/** Mirrors {@link SessionKind}. */
const SESSION_KINDS: ReadonlySet<SessionKind> = new Set([
    "lesson",
    "quiz",
    "review",
    "trial",
    "placement",
    "mixed",
]);

/** Mirrors {@link ItemType}. */
const ITEM_TYPE_SET: ReadonlySet<ItemType> = new Set(ITEM_TYPES);

const CEFR_LEVELS: ReadonlySet<CefrLevel> = new Set(["A1", "A2", "B1", "B2"]);
const LEARNER_MODES: ReadonlySet<LearnerMode> = new Set(["english", "thai"]);
const LOCALE_SET: ReadonlySet<Locale> = new Set(LOCALES);
const OUTCOME_SET: ReadonlySet<Outcome> = new Set(OUTCOMES);
const EXPERIMENT_SET: ReadonlySet<Experiment> = new Set(EXPERIMENTS);

/**
 * Numeric metrics describe counts and positions, never arbitrary numbers: negative,
 * fractional, non-finite or absurdly large values are either a bug upstream or a probe,
 * and either way must not reach GA. The bound is generous relative to any real session —
 * a course has a few thousand words — so it rejects only implausible input.
 */
const MAX_METRIC_VALUE = 100_000;

const isBoundedNonnegativeInteger = (value: number): boolean =>
    Number.isInteger(value) && Number.isFinite(value) && value >= 0 && value <= MAX_METRIC_VALUE;

/**
 * `sourcePath` may only ever be a path: no scheme, no host, no query string and no
 * fragment, any of which could carry a token or a full URL past the "just a path" intent
 * documented on {@link LifecycleProps.sourcePath}.
 */
const sanitisePathname = (value: string): string | undefined => {
    if (!value.startsWith("/") || value.startsWith("//")) return undefined;
    // Backslashes are interpreted as path separators by browsers/URL parsers and can
    // turn an apparently relative value into a protocol-relative URL after normalising.
    if (value.includes("\\")) return undefined;
    if (/\s/.test(value)) return undefined;
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code < 0x20 || code === 0x7f) return undefined;
    }
    const pathOnly = value.split(/[?#]/)[0];
    return pathOnly || undefined;
};

/**
 * The complete set of properties any lifecycle event may carry. Every field is either an
 * anonymous descriptor of *what happened* (locale, family, level, counts) or an explicit
 * analytics-only identifier — never anything that identifies the person. There is
 * deliberately no `userId`, `email`, `answer` or `token` field; see {@link ALLOWED_KEYS}.
 */
export type LifecycleProps = {
    /** Interface locale — one of {@link LOCALES}. */
    locale?: Locale;
    /** Course direction — which way round the learner is going. */
    direction?: LearnerMode;
    /** Which public template the visit landed on. */
    acquisitionFamily?: AcquisitionFamily;
    /** Path only — never a full URL, never query string (may carry a token). */
    sourcePath?: string;
    level?: CefrLevel;
    unit?: number;
    round?: number;
    sessionKind?: SessionKind;
    /** Experiment assignment id, when one is running — one of {@link EXPERIMENTS}. */
    experiment?: Experiment;
    /** Which mixed-session variant an item was — one of {@link ITEM_TYPES}, never a word. */
    itemType?: ItemType;
    /** 1-based position within a session. A count, not content. */
    itemIndex?: number;
    itemCount?: number;
    /** How many of the session's targets were due reviews — a count, not which words. */
    dueCount?: number;
    /** How many items were graded correct in the session so far — a count, not which. */
    correctCount?: number;
    /** Whether a graded answer was correct — a boolean, never the chosen text. */
    correct?: boolean;
    /** A constrained outcome label — one of {@link OUTCOMES}, never free-form text. */
    outcome?: Outcome;
    durationSec?: number;
};

/**
 * The runtime privacy fence. Only these keys survive into a `gtag` payload; the
 * pseudonymous id is added separately. Adding a field to {@link LifecycleProps} without
 * adding it here means it will never be sent — which is the safe default for a mistake.
 */
const ALLOWED_KEYS: ReadonlySet<keyof LifecycleProps> = new Set([
    "locale",
    "direction",
    "acquisitionFamily",
    "sourcePath",
    "level",
    "unit",
    "round",
    "sessionKind",
    "experiment",
    "itemType",
    "itemIndex",
    "itemCount",
    "dueCount",
    "correctCount",
    "correct",
    "outcome",
    "durationSec",
]);

const ANALYTICS_ID_KEY = "va_analytics_id";

type AnalyticsWindow = Window & {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
};

const analyticsWindow = (): AnalyticsWindow | undefined =>
    typeof window === "undefined" ? undefined : (window as AnalyticsWindow);

/**
 * A pseudonymous, rotatable id that is *not* the application `userId`
 * (`docs/LEARNER-LIFECYCLE.md` §7.1). It lets events for one browser be joined without
 * ever exposing the D1 join key. It lives in `localStorage`, so clearing site data
 * rotates it; {@link rotateAnalyticsId} rotates it deliberately (e.g. on logout).
 */
export const getAnalyticsId = (): string | undefined => {
    const win = analyticsWindow();
    if (!win) return undefined;

    try {
        const existing = win.localStorage.getItem(ANALYTICS_ID_KEY);
        if (existing) return existing;

        const fresh = win.crypto.randomUUID();
        win.localStorage.setItem(ANALYTICS_ID_KEY, fresh);
        return fresh;
    } catch {
        // Private-mode Safari and storage-blocked embeds throw on access. Anonymous
        // measurement is best-effort; it must never break the page it measures.
        return undefined;
    }
};

/** Discard the current pseudonymous id and mint a new one on next use. */
export const rotateAnalyticsId = (): void => {
    const win = analyticsWindow();
    if (!win) return;
    try {
        win.localStorage.removeItem(ANALYTICS_ID_KEY);
    } catch {
        // See getAnalyticsId — best-effort.
    }
};

/**
 * Numeric metric fields — bounded, nonnegative, finite integers. Anything else (a count
 * field is not where a bearer token or a NaN belongs) is dropped rather than coerced.
 */
const NUMERIC_METRIC_KEYS: ReadonlySet<keyof LifecycleProps> = new Set([
    "unit",
    "round",
    "itemIndex",
    "itemCount",
    "dueCount",
    "correctCount",
    "durationSec",
]);

/**
 * Per-key runtime validation. A value that type-checked at compile time can still be
 * wrong at runtime — a cast, a value smuggled through `as`, or a caller that stopped
 * respecting the type — so every enum field is re-checked against its allow-list here,
 * not trusted because {@link LifecycleProps} says it should already be safe.
 */
const isValid = (key: keyof LifecycleProps, value: unknown): boolean => {
    switch (key) {
        case "locale":
            return typeof value === "string" && LOCALE_SET.has(value as Locale);
        case "direction":
            return typeof value === "string" && LEARNER_MODES.has(value as LearnerMode);
        case "acquisitionFamily":
            return (
                typeof value === "string" &&
                ACQUISITION_FAMILIES.has(value as AcquisitionFamily)
            );
        case "sourcePath":
            return typeof value === "string" && sanitisePathname(value) !== undefined;
        case "level":
            return typeof value === "string" && CEFR_LEVELS.has(value as CefrLevel);
        case "sessionKind":
            return typeof value === "string" && SESSION_KINDS.has(value as SessionKind);
        case "itemType":
            return typeof value === "string" && ITEM_TYPE_SET.has(value as ItemType);
        case "experiment":
            return typeof value === "string" && EXPERIMENT_SET.has(value as Experiment);
        case "outcome":
            return typeof value === "string" && OUTCOME_SET.has(value as Outcome);
        case "correct":
            return typeof value === "boolean";
        default:
            if (NUMERIC_METRIC_KEYS.has(key)) {
                return typeof value === "number" && isBoundedNonnegativeInteger(value);
            }
            return false;
    }
};

/**
 * Copy only allow-listed properties whose value also passes its field-specific runtime
 * check. Three guards, all deliberate: unknown keys are dropped (privacy fence), enum
 * fields are checked against a closed allow-list rather than trusted as already-valid
 * strings, and `sourcePath` is normalised down to a bare pathname so it can never carry a
 * query string or a full URL.
 */
const sanitise = (props: LifecycleProps): Record<string, string | number | boolean> => {
    const out: Record<string, string | number | boolean> = {};
    for (const key of ALLOWED_KEYS) {
        const value = props[key];
        if (value === undefined || value === null) continue;
        if (!isValid(key, value)) continue;
        out[key] = key === "sourcePath" ? (sanitisePathname(value as string) as string) : value;
    }
    return out;
};

/**
 * Emit one lifecycle event. Client-only and best-effort: with no `gtag` on the page (GA
 * disabled, or a consent gate) it is a silent no-op. It never throws — an analytics
 * failure must not take a learning session down with it.
 */
export const track = (event: LifecycleEvent, props: LifecycleProps = {}): boolean => {
    const win = analyticsWindow();
    if (!win || typeof win.gtag !== "function") return false;

    const payload = sanitise(props);
    const analyticsId = getAnalyticsId();
    if (analyticsId) payload.analytics_id = analyticsId;

    try {
        win.gtag("event", event, payload);
        return true;
    } catch {
        // Best-effort; see track's contract above.
        return false;
    }
};

import { expect, test } from "@playwright/test";

import {
  EXPERIMENTS,
  ITEM_TYPES,
  LIFECYCLE_EVENTS,
  LOCALES,
  OUTCOMES,
  getAnalyticsId,
  rotateAnalyticsId,
  track,
} from "../../lib/analytics";

/**
 * The analytics module is the one privacy fence between product code and GA. Its
 * contract (docs/LEARNER-LIFECYCLE.md §7.1) is enforced here: only allow-listed,
 * primitive properties leave the browser, a pseudonymous id rides along but the
 * application `userId`/email never do, and a missing `gtag` is a silent no-op rather
 * than a thrown error that takes a session down.
 */

type GtagCall = { command: string; event: string; params: Record<string, unknown> };

type FakeWindow = {
  gtag?: (command: string, event: string, params: Record<string, unknown>) => void;
  localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  crypto: Crypto;
};

const setWindow = (win: FakeWindow | undefined) => {
  (globalThis as { window?: unknown }).window = win;
};

const makeWindow = (withGtag = true) => {
  const calls: GtagCall[] = [];
  const store = new Map<string, string>();
  const win: FakeWindow = {
    localStorage: {
      getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key),
    },
    crypto: globalThis.crypto,
  };
  if (withGtag) {
    win.gtag = (command, event, params) => calls.push({ command, event, params });
  }
  setWindow(win);
  return { calls, store };
};

test.afterEach(() => setWindow(undefined));

test.describe("track", () => {
  test("emits the event name with allow-listed properties and a pseudonymous id", () => {
    const { calls } = makeWindow();

    track("session_completed", {
      sessionKind: "lesson",
      level: "A1",
      unit: 3,
      correct: true,
      itemCount: 8,
    });

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.command).toBe("event");
    expect(call.event).toBe("session_completed");
    expect(call.params).toMatchObject({
      sessionKind: "lesson",
      level: "A1",
      unit: 3,
      correct: true,
      itemCount: 8,
    });
    expect(typeof call.params.analytics_id).toBe("string");
  });

  test("drops keys that are not on the allow-list", () => {
    const { calls } = makeWindow();

    track("signup_completed", {
      locale: "th",
      // Fields the taxonomy forbids — smuggled in past the type via a cast.
      ...({ userId: "u_123", email: "a@b.com", token: "secret" } as object),
    });

    const [call] = calls;
    expect(call.params.locale).toBe("th");
    expect(call.params).not.toHaveProperty("userId");
    expect(call.params).not.toHaveProperty("email");
    expect(call.params).not.toHaveProperty("token");
  });

  test("drops non-primitive values even on an allow-listed key", () => {
    const { calls } = makeWindow();

    track("public_page_viewed", {
      acquisitionFamily: "word",
      // An object on an allowed key must not slip through.
      sourcePath: { toString: () => "/leak" } as unknown as string,
    });

    const [call] = calls;
    expect(call.params.acquisitionFamily).toBe("word");
    expect(call.params).not.toHaveProperty("sourcePath");
  });

  test("drops an out-of-union locale smuggled past the type via a cast", () => {
    const { calls } = makeWindow();

    track("signup_started", { locale: "en-US" as unknown as "en" });

    const [call] = calls;
    expect(call.params).not.toHaveProperty("locale");
  });

  test("drops an out-of-union outcome", () => {
    const { calls } = makeWindow();

    track("session_completed", {
      outcome: "definitely_mastered" as unknown as "completed",
    });

    const [call] = calls;
    expect(call.params).not.toHaveProperty("outcome");
  });

  test("drops an unregistered experiment id", () => {
    const { calls } = makeWindow();

    track("session_started", {
      experiment: "unreviewed_experiment" as unknown as "trial_length_5_vs_7",
    });

    const [call] = calls;
    expect(call.params).not.toHaveProperty("experiment");
  });

  test("drops an out-of-union sessionKind and acquisitionFamily", () => {
    const { calls } = makeWindow();

    track("session_started", {
      sessionKind: "bonus_round" as unknown as "lesson",
      acquisitionFamily: "social" as unknown as "home",
    });

    const [call] = calls;
    expect(call.params).not.toHaveProperty("sessionKind");
    expect(call.params).not.toHaveProperty("acquisitionFamily");
  });

  test("strips a query string and fragment from sourcePath, keeping the pathname", () => {
    const { calls } = makeWindow();

    track("public_page_viewed", {
      sourcePath: "/th/auth/verify?token=super-secret#frag",
    });

    const [call] = calls;
    expect(call.params.sourcePath).toBe("/th/auth/verify");
  });

  test("drops a sourcePath that is a full URL rather than a path", () => {
    const { calls } = makeWindow();

    track("public_page_viewed", { sourcePath: "https://evil.example/th" });

    const [call] = calls;
    expect(call.params).not.toHaveProperty("sourcePath");
  });

  test("drops a protocol-relative sourcePath", () => {
    const { calls } = makeWindow();

    track("public_page_viewed", { sourcePath: "//evil.example" });

    const [call] = calls;
    expect(call.params).not.toHaveProperty("sourcePath");
  });

  test("drops a sourcePath containing a backslash", () => {
    const { calls } = makeWindow();

    track("public_page_viewed", { sourcePath: "/\\evil.example/token" });

    const [call] = calls;
    expect(call.params).not.toHaveProperty("sourcePath");
  });

  test("drops a sourcePath carrying a control character", () => {
    const { calls } = makeWindow();

    track("public_page_viewed", { sourcePath: "/th/profile\0/x" });

    const [call] = calls;
    expect(call.params).not.toHaveProperty("sourcePath");
  });

  for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 100_001]) {
    test(`drops a numeric metric that is not a bounded nonnegative integer (${bad})`, () => {
      const { calls } = makeWindow();

      track("session_started", { itemCount: bad });

      const [call] = calls;
      expect(call.params).not.toHaveProperty("itemCount");
    });
  }

  test("keeps a numeric metric of exactly zero and exactly the upper bound", () => {
    const { calls } = makeWindow();

    track("session_started", { itemCount: 0, unit: 100_000 });

    const [call] = calls;
    expect(call.params.itemCount).toBe(0);
    expect(call.params.unit).toBe(100_000);
  });

  test("drops a numeric metric smuggled in as a numeric string", () => {
    const { calls } = makeWindow();

    track("session_started", { itemCount: "3" as unknown as number });

    const [call] = calls;
    expect(call.params).not.toHaveProperty("itemCount");
  });

  test("is a silent no-op when gtag is absent", () => {
    makeWindow(false);
    expect(() => track("session_started", { level: "A1" })).not.toThrow();
  });

  test("is a silent no-op on the server, where there is no window", () => {
    setWindow(undefined);
    expect(() => track("session_started", { level: "A1" })).not.toThrow();
  });
});

test.describe("analytics id", () => {
  test("is stable across calls within a browser", () => {
    makeWindow();
    const first = getAnalyticsId();
    const second = getAnalyticsId();
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  test("rotation mints a different id", () => {
    makeWindow();
    const before = getAnalyticsId();
    rotateAnalyticsId();
    const after = getAnalyticsId();
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  });

  test("is undefined on the server", () => {
    setWindow(undefined);
    expect(getAnalyticsId()).toBeUndefined();
  });
});

/**
 * The exported taxonomy sets are the single source of truth: the type-level unions, the
 * runtime allow-lists in the guard, and every test above all derive from them. These
 * assertions pin their invariants directly — no duplicate value survives (a dupe would
 * silently shrink a `Set`-backed check), the values the product depends on are present,
 * and `track`'s runtime validation accepts exactly the members of each set and rejects a
 * non-member — so the guard and the exported sets can never drift apart unnoticed.
 */
test.describe("taxonomy invariants", () => {
  const noDuplicates = (name: string, values: readonly string[]) => {
    test(`${name} has no duplicate values`, () => {
      expect(new Set(values).size).toBe(values.length);
    });
  };

  noDuplicates("LIFECYCLE_EVENTS", LIFECYCLE_EVENTS);
  noDuplicates("ITEM_TYPES", ITEM_TYPES);
  noDuplicates("LOCALES", LOCALES);
  noDuplicates("OUTCOMES", OUTCOMES);
  noDuplicates("EXPERIMENTS", EXPERIMENTS);

  test("LIFECYCLE_EVENTS carries the critical L0 transitions", () => {
    for (const event of [
      "public_page_viewed",
      "signup_completed",
      "session_started",
      "answer_submitted",
      "session_completed",
    ]) {
      expect(LIFECYCLE_EVENTS).toContain(event);
    }
  });

  test("ITEM_TYPES covers every mixed-session variant", () => {
    expect([...ITEM_TYPES].sort()).toEqual(
      [
        "choose-meaning",
        "choose-word",
        "cloze",
        "listen-choose",
        "match-pairs",
        "speed-round",
        "spelling",
      ],
    );
  });

  test("LOCALES is exactly the shipped interface locales", () => {
    expect([...LOCALES].sort()).toEqual(["en", "th"]);
  });

  test("OUTCOMES is exactly the constrained outcome labels", () => {
    expect([...OUTCOMES].sort()).toEqual(["completed", "known", "review"]);
  });

  test("EXPERIMENTS carries the predeclared first candidates", () => {
    expect([...EXPERIMENTS].sort()).toEqual([
      "comeback_batch_size",
      "trial_immediate_vs_choice",
      "trial_length_5_vs_7",
      "word_cta_specificity",
    ]);
  });

  test("track accepts every LOCALES member and rejects a non-member", () => {
    for (const locale of LOCALES) {
      const { calls } = makeWindow();
      track("signup_started", { locale });
      expect(calls[0].params.locale).toBe(locale);
    }
    const { calls } = makeWindow();
    track("signup_started", { locale: "en-GB" as unknown as "en" });
    expect(calls[0].params).not.toHaveProperty("locale");
  });

  test("track accepts every ITEM_TYPES member and rejects a non-member", () => {
    for (const itemType of ITEM_TYPES) {
      const { calls } = makeWindow();
      track("answer_submitted", { itemType });
      expect(calls[0].params.itemType).toBe(itemType);
    }
    const { calls } = makeWindow();
    track("answer_submitted", { itemType: "crossword" as unknown as "spelling" });
    expect(calls[0].params).not.toHaveProperty("itemType");
  });

  test("track accepts every OUTCOMES member and rejects a non-member", () => {
    for (const outcome of OUTCOMES) {
      const { calls } = makeWindow();
      track("session_completed", { outcome });
      expect(calls[0].params.outcome).toBe(outcome);
    }
    const { calls } = makeWindow();
    track("session_completed", { outcome: "mastered" as unknown as "completed" });
    expect(calls[0].params).not.toHaveProperty("outcome");
  });

  test("track accepts every EXPERIMENTS member and rejects a non-member", () => {
    for (const experiment of EXPERIMENTS) {
      const { calls } = makeWindow();
      track("session_started", { experiment });
      expect(calls[0].params.experiment).toBe(experiment);
    }
    const { calls } = makeWindow();
    track("session_started", { experiment: "ghost_test" as unknown as "trial_length_5_vs_7" });
    expect(calls[0].params).not.toHaveProperty("experiment");
  });

  test("track emits every LIFECYCLE_EVENTS name verbatim", () => {
    for (const event of LIFECYCLE_EVENTS) {
      const { calls } = makeWindow();
      track(event);
      expect(calls[0].event).toBe(event);
    }
  });
});

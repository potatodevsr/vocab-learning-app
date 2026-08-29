import { getTranslations } from "next-intl/server";

/**
 * A compact trail of real vocabulary — English word, Thai meaning.
 *
 * Decoration made of the product itself: a visitor learns what the app contains
 * before reading a single line of marketing copy. It is also the cheapest possible
 * illustration — text and two borders, no image payload on a Thai mobile connection
 * (SPEC §6.1).
 *
 * The sample below is fixed rather than fetched: the landing page must render when the
 * API is unavailable, and a marketing band is the wrong place to take that risk. These
 * are vocabulary entries, not interface copy, which is why they are not in
 * `messages/*.json` — the same call `HeroWordIllustration` makes.
 */
const SAMPLE = [
  { en: "improve", th: "พัฒนา" },
  { en: "culture", th: "วัฒนธรรม" },
  { en: "achieve", th: "บรรลุ" },
  { en: "explain", th: "อธิบาย" },
  { en: "decide", th: "ตัดสินใจ" },
  { en: "believe", th: "เชื่อ" },
  { en: "prepare", th: "เตรียม" },
  { en: "discover", th: "ค้นพบ" },
  { en: "remember", th: "จดจำ" },
  { en: "practice", th: "ฝึกฝน" },
];

export async function WordTicker() {
  const t = await getTranslations("Home");

  return (
    <section
      aria-label={t("tickerLabel")}
      data-testid="word-trail"
      className="border-b-2 border-ink bg-accent-sun text-ink"
    >
      {/* One row that scrolls, not a grid that leaves holes. Five items in two columns
          is three rows with the bottom-right cell empty, and `odd:border-r-2` then drew a
          divider on item 5 pointing into that hole. A phone gets the trail as a row it
          can push; from `sm` all five fit and the row stops scrolling on its own. */}
      <ul className="play-trail-row mx-auto flex w-full max-w-plate snap-x snap-mandatory overflow-x-auto px-4 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-6 lg:px-8">
        {SAMPLE.slice(0, 5).map((word, index) => (
          <li
            key={word.en}
            className="flex min-h-20 min-w-[42vw] shrink-0 snap-start items-center justify-between gap-3 border-ink py-3 pr-4 [&:not(:last-child)]:border-r-2 sm:min-w-0 sm:px-4 sm:last:border-r-0"
          >
            <span>
              <span className="block text-base font-extrabold tracking-tight sm:text-lg">{word.en}</span>
              <span className="font-thai block text-sm font-semibold text-ink/70" lang="th">{word.th}</span>
            </span>
            <span aria-hidden className="font-mono text-[10px] font-bold tabular-nums text-ink/45">
              {String(index + 1).padStart(2, "0")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

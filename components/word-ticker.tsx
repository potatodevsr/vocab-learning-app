import { getTranslations } from "next-intl/server";

/**
 * A band of real vocabulary moving past — English word, Thai meaning, repeat.
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

  // Two identical runs: the track translates by exactly half its width, so the
  // second run is under the pointer at the moment the first one leaves.
  const runs = [SAMPLE, SAMPLE];

  return (
    <section
      aria-label={t("tickerLabel")}
      className="play-marquee border-y-3 border-ink bg-accent-sun py-4"
    >
      <div className="play-marquee-track">
        {runs.map((run, runIndex) => (
          <ul
            key={runIndex}
            aria-hidden={runIndex === 1}
            className="flex shrink-0 items-center"
          >
            {run.map((word) => (
              <li
                key={`${runIndex}-${word.en}`}
                className="flex items-center gap-3 whitespace-nowrap px-6 text-ink"
              >
                <span className="text-xl font-extrabold tracking-tight sm:text-2xl">
                  {word.en}
                </span>
                <span className="font-thai text-lg font-semibold" lang="th">
                  {word.th}
                </span>
                <span aria-hidden className="text-xl font-black opacity-40">
                  ✦
                </span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}

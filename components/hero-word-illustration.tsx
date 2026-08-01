import { Check, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

const cards = [
  {
    word: "improve",
    level: "A2",
    pronunciation: "อิม-พรูฟ",
    meaning: "พัฒนา / ทำให้ดีขึ้น",
    example: "She wants to improve her English every day.",
    delay: "0s",
  },
  {
    word: "culture",
    level: "A1",
    pronunciation: "คัล-เชอร์",
    meaning: "วัฒนธรรม",
    example: "Food is part of Thai culture.",
    delay: "-4s",
  },
  {
    word: "achieve",
    level: "A2",
    pronunciation: "อะ-ชีฟ",
    meaning: "บรรลุ / ทำสำเร็จ",
    example: "You can achieve your goal with practice.",
    delay: "-8s",
  },
];

export function HeroWordIllustration() {
  const t = useTranslations("Home");

  return (
    // Decorative: the cards below are a picture of the product, and a screen reader
    // reading three sample words as if they were content is noise.
    <div
      aria-hidden
      data-testid="hero-word-illustration"
      className="relative isolate mx-auto h-[460px] w-full max-w-[460px]"
    >
      {/*
        A solid sun panel, not a 30% wash of it over the blue hero: the wash read as
        muddy grey-blue and gave the white cards nothing to sit against. The panel is a
        sticker like everything else — ink rule, hard shadow.
      */}
      <div className="absolute inset-0 z-0 rounded-[32px] border-3 border-ink bg-accent-sun shadow-[10px_10px_0_0_var(--ink)]" />

      <div className="play-stamp absolute left-5 top-5 z-30 bg-white px-3 py-1 text-xs font-extrabold text-ink [--tilt:-3deg]">
        {t("illustrationPreview")}
      </div>

      <div className="play-stamp absolute right-5 top-5 z-30 bg-white px-3 py-1 text-xs font-extrabold text-ink [--tilt:3deg]">
        {t("illustrationCards")}
      </div>

      {/*
        The deck sits inside the panel with room on every side, so the cycling cards
        never run under the panel edge — the old box clipped whichever card was mid-swap.
      */}
      <div
        data-testid="hero-card-stage"
        className="hero-card-stage absolute z-10"
      >
        {cards.map((card) => (
          <article
            key={card.word}
            data-hero-word={card.word}
            className="hero-card-cycle play-card absolute left-0 top-0 w-full rounded-[24px] p-5 text-foreground"
            style={{ animationDelay: card.delay }}
          >
            <div className="flex items-center justify-between">
              <Badge className="bg-brand text-white hover:bg-brand">
                {card.level}
              </Badge>
            </div>

            <div className="mt-5">
              <h3 className="text-4xl font-semibold tracking-tight">
                {card.word}
              </h3>

              <p
                className="font-thai mt-2 text-sm font-medium text-muted-foreground"
                lang="th"
              >
                {card.pronunciation}
              </p>

              <p
                className="font-thai mt-5 text-lg font-semibold leading-7"
                lang="th"
              >
                {card.meaning}
              </p>

              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {card.example}
              </p>
            </div>

            {/*
              Drawn, not wired. These were real <button>s in a decorative illustration:
              they took focus, showed a pointer cursor and did nothing when clicked — a
              control that lies about being one. They are now inert shapes, hidden from
              assistive tech along with the rest of the picture.
            */}
            <div className="mt-7 grid grid-cols-2 gap-3">
              <span className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-success text-sm font-medium text-white">
                <Check className="size-4" />I know this
              </span>

              <span className="flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-white text-sm font-medium">
                <RotateCcw className="size-4" />
                Review
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

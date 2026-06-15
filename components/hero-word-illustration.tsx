import { Check, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  return (
    <div className="relative mx-auto h-[560px] w-full max-w-[560px] overflow-hidden">
      <div className="absolute inset-0 rounded-[32px] border border-white/10 bg-white/5" />

      <div className="absolute left-6 top-6 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-zinc-300">
        UI preview
      </div>

      <div className="absolute right-6 top-6 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-zinc-300">
        Word cards
      </div>

      <div className="absolute left-[calc(50%-160px)] top-[122px] h-[340px] w-[320px]">
        {cards.map((card) => (
          <article
            key={card.word}
            className="hero-card-cycle absolute left-0 top-0 w-full rounded-[32px] border border-white/10 bg-white p-6 text-zinc-950 shadow-2xl"
            style={{ animationDelay: card.delay }}
          >
            <div className="flex items-center justify-between">
              <Badge className="bg-zinc-950 text-white hover:bg-zinc-950">
                {card.level}
              </Badge>
            </div>

            <div className="mt-5">
              <h3 className="text-4xl font-semibold tracking-tight">
                {card.word}
              </h3>

              <p
                className="font-thai mt-2 text-sm font-medium text-zinc-500"
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

              <p className="mt-4 text-sm leading-6 text-zinc-600">
                {card.example}
              </p>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <Button className="rounded-full bg-pink-600 text-white hover:bg-pink-500">
                <Check className="size-4" />I know this
              </Button>

              <Button
                variant="outline"
                className="rounded-full border-zinc-200 bg-white hover:bg-zinc-50"
              >
                <RotateCcw className="size-4" />
                Review
              </Button>
            </div>
          </article>
        ))}
      </div>

      <div className="absolute bottom-8 left-8 right-8 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center text-sm text-zinc-300">
        Thai meaning · pronunciation · CEFR levels
      </div>
    </div>
  );
}

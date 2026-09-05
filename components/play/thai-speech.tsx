"use client";

import { useCallback, useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Browser speech for the Thai meaning on the English-reader word page.
 *
 * This is deliberately separate from `WordAudio`: English word clips are pre-generated
 * because listening questions must be identical for every learner. This control is a
 * reading aid, not graded content, and the corpus has no stored Thai-meaning clip key.
 */
export function ThaiSpeech({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const t = useTranslations("Audio");
  const [speaking, setSpeaking] = useState(false);

  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );

  const speak = useCallback(() => {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH";
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [text]);

  return (
    <button
      type="button"
      onClick={speak}
      data-testid="thai-meaning-audio"
      aria-label={t("playThai", { word: text })}
      aria-pressed={speaking}
      className={cn(
        "play-key inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-sun text-ink [--lift:3px] hover:bg-accent-sun",
        speaking && "motion-safe:animate-pulse",
        className,
      )}
    >
      <Volume2 className="size-5" aria-hidden />
    </button>
  );
}

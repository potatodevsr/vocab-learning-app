"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { audioUrl } from "@/lib/audio";
import { cn } from "@/lib/utils";

/**
 * The play button for a word's pre-generated speech.
 *
 * Renders nothing when the word has no clip. That is the whole "not generated yet" story
 * — an absent control rather than a disabled one, because a greyed-out speaker on a
 * beginner's first card reads as "this app is broken", not as "this row is queued".
 *
 * `new Audio()` rather than a mounted `<audio>` element: the clip is a one-shot sound
 * effect, there is no transport to show, and a hidden media element per word on a
 * twenty-word unit page is twenty extra network-capable nodes for nothing.
 *
 * A failed load hides the button for the rest of the page's life. The learner has already
 * pressed something that did nothing once; offering it again is worse than admitting the
 * clip is not there.
 */
export function WordAudio({
  audioKey,
  word,
  className,
  size = "default",
}: {
  audioKey: string | null | undefined;
  /** The word being spoken — for the accessible label, never rendered visually. */
  word: string;
  className?: string;
  size?: "default" | "large";
}) {
  const t = useTranslations("Audio");
  const source = audioUrl(audioKey);

  const [state, setState] = useState<"idle" | "loading" | "playing" | "failed">("idle");
  const elementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      // Leaving the page mid-clip must not keep the sound going.
      elementRef.current?.pause();
      elementRef.current = null;
    },
    [],
  );

  const play = useCallback(async () => {
    if (!source) return;

    /**
     * A fresh element per press rather than rewinding the stored one.
     *
     * Two reasons, and they agree. Pausing the previous clip before replacing it *is* the
     * restart behaviour — a second press starts the sound again instead of stacking a
     * second voice over the first. And the cleanup effect above reads
     * `elementRef.current`: assigning to a value an effect has already observed is what
     * the React Compiler refuses ("This value cannot be modified"), so the element that
     * gets configured here is always one nothing has seen yet.
     */
    elementRef.current?.pause();

    const element = new Audio(source);
    element.onplaying = () => setState("playing");
    element.onended = () => setState("idle");
    element.onerror = () => setState("failed");

    elementRef.current = element;
    setState("loading");

    try {
      await element.play();
    } catch {
      // Autoplay policies reject a play() the user did not gesture for. This one is
      // always a click, so a rejection here means the media itself failed.
      setState("failed");
    }
  }, [source]);

  if (!source || state === "failed") return null;

  return (
    <button
      type="button"
      onClick={play}
      data-testid="word-audio"
      aria-label={t("play", { word })}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-3 border-ink bg-accent-sun text-ink transition-transform duration-150",
        "hover:-translate-y-0.5 hover:bg-accent-sun/90 active:translate-y-0",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40",
        // The reward for pressing it is the sound; the pulse is only there so a learner
        // with the volume down still sees that something happened.
        state === "playing" && "motion-safe:animate-pulse",
        size === "large" ? "size-14" : "size-10",
        className,
      )}
    >
      {state === "loading" ? (
        <Loader2 className={cn("animate-spin", size === "large" ? "size-6" : "size-5")} />
      ) : (
        <Volume2 className={size === "large" ? "size-7" : "size-5"} />
      )}
    </button>
  );
}

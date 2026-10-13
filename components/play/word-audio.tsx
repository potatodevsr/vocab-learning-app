"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, Volume2 } from "lucide-react";
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
 * A failed load hides the button — for *this clip*. The learner has already pressed
 * something that did nothing once; offering it again is worse than admitting the clip is
 * not there. The failure is per-source, not per-mount: a component that goes on to a
 * different word gets its speaker back, which it did not before, so one dead clip used to
 * silence every word after it on the same card stack.
 *
 * `essential` turns that policy off, for the one place where the button *is* the question.
 * A `listen-choose` item ships no written word at all — hearing it is the prompt — so
 * hiding the control there leaves four Thai options and nothing to answer about. Marked
 * essential, a failure keeps the control and says so, and pressing it tries again.
 */
export function WordAudio({
  audioKey,
  word,
  className,
  size = "default",
  essential = false,
}: {
  audioKey: string | null | undefined;
  /** The word being spoken — for the accessible label, never rendered visually. */
  word: string;
  className?: string;
  size?: "default" | "large";
  /** True where the clip is the prompt itself, so a failure may not remove the control. */
  essential?: boolean;
}) {
  const t = useTranslations("Audio");
  const source = audioUrl(audioKey);

  const [state, setState] = useState<"idle" | "loading" | "playing" | "failed">("idle");
  const elementRef = useRef<HTMLAudioElement | null>(null);

  /**
   * A verdict about one clip must not outlive it.
   *
   * `failed` was component state on a component the session reuses across items, so one
   * dead file removed the speaker from every word after it. This is React's own
   * adjust-state-during-render pattern rather than an effect: the reset has to land in the
   * same render as the new source, or the button paints one frame of the previous word's
   * failure.
   */
  const [renderedSource, setRenderedSource] = useState(source);
  if (renderedSource !== source) {
    setRenderedSource(source);
    setState("idle");
  }

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

  if (!source) return null;
  if (state === "failed" && !essential) return null;

  const failed = state === "failed";

  return (
    <button
      type="button"
      onClick={play}
      data-testid="word-audio"
      data-state={state}
      aria-label={failed ? t("retry", { word }) : t("play", { word })}
      className={cn(
        // `play-key` rather than a hand-rolled lift: this was the app's one button that
        // moved *up* on press and answered a keyboard with shadcn's translucent ring
        // instead of the house ink outline.
        "play-key inline-flex shrink-0 items-center justify-center rounded-full bg-accent-sun text-ink [--lift:3px]",
        "hover:bg-accent-sun",
        // The reward for pressing it is the sound; the pulse is only there so a learner
        // with the volume down still sees that something happened.
        state === "playing" && "motion-safe:animate-pulse",
        // An essential clip that would not play: still a control, and visibly not the
        // resting one, so the learner knows the press registered and can try again.
        failed && "bg-warn",
        size === "large" ? "size-14" : "size-10",
        className,
      )}
    >
      {state === "loading" ? (
        <Loader2 className={cn("animate-spin", size === "large" ? "size-6" : "size-5")} />
      ) : failed ? (
        <RotateCcw className={size === "large" ? "size-7" : "size-5"} />
      ) : (
        <Volume2 className={size === "large" ? "size-7" : "size-5"} />
      )}
    </button>
  );
}

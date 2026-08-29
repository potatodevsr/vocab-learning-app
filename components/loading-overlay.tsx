import { Loader2 } from "lucide-react";

type Props = {
  /**
   * Required, and deliberately so. The default used to be a hardcoded Thai string
   * (`"กำลังโหลด..."`) baked into a component that also renders on the English locale —
   * AGENTS.md rule 3. Every one of the three call sites already passes a translated
   * message; the default only existed to hide that a fourth might not.
   */
  message: string;
};

/**
 * The full-screen wait, for the two moments the app genuinely blocks: exchanging a magic
 * link and signing out.
 *
 * It used to be `bg-zinc-950/80` with `backdrop-blur-sm` and `text-zinc-400` — the only
 * blur in the whole app, in the near-black zinc palette SPEC §6.3 removed, dropped over a
 * light warm canvas. It is drawn in the app's own language now: a solid ink scrim, the
 * brand spinner, and a card that says what is happening.
 */
export function LoadingOverlay({ message }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 p-6"
    >
      <div className="play-sticker flex flex-col items-center gap-4 px-8 py-7 [--tile-block:var(--accent-sky)]">
        <Loader2 className="size-10 animate-spin text-brand" aria-hidden />
        <p className="text-center text-sm font-semibold text-ink">{message}</p>
      </div>
    </div>
  );
}

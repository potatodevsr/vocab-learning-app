"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Share2 } from "lucide-react";

/**
 * "I've learned 250 of the Oxford 3000."
 *
 * The cheapest acquisition channel a product with no marketing budget has is a learner
 * telling someone else, and the thing worth telling is the collection number — it is
 * finite, it is theirs, and it means something to a stranger in a way "12-day streak"
 * does not.
 *
 * Deliberately the platform share sheet rather than per-network buttons: it reaches the
 * apps this audience actually uses (LINE, Messenger) without embedding a single third-party
 * script, and it cannot track anyone. Where `navigator.share` is missing — most desktop
 * browsers — it copies the same sentence to the clipboard instead, which is what a person
 * on a laptop was going to do by hand anyway.
 *
 * Nothing here is generated on a server and nothing is stored: the text is built from
 * numbers already on screen, so there is no shareable URL carrying someone's progress
 * around for anyone who finds the link.
 */
export function ShareResult({
  owned,
  total,
  className,
}: {
  owned: number;
  total: number;
  className?: string;
}) {
  const t = useTranslations("Share");
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = typeof window === "undefined" ? "" : window.location.origin;
    const text = t("text", { owned, total });

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: t("title"), text, url });
        return;
      } catch {
        // A dismissed share sheet is a normal outcome, not an error — fall through to the
        // clipboard so the button still did something.
      }
    }

    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked (insecure context, permissions). Nothing useful to say beyond
      // leaving the button as it was.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      data-testid="share-result"
      className={`play-press inline-flex h-14 items-center gap-2 rounded-2xl border-3 border-ink bg-accent-sun px-6 text-base font-bold text-ink ${className ?? ""}`}
    >
      {copied ? <Check className="size-5" /> : <Share2 className="size-5" />}
      {copied ? t("copied") : t("cta")}
    </button>
  );
}

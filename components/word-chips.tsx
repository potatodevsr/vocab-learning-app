import { Link } from "@/i18n/navigation";
import { normaliseThai } from "@/lib/thai-text";
import type { OxfordWord } from "@/lib/types";

/**
 * A list of corpus words, each linking to its own page.
 *
 * Every editorial family added in SEO-CONTENT §U–§AB ends in the same block: here are the
 * words this page is about, go and read one. Sharing it keeps the internal-link shape
 * identical across families — which is the point of §5 — and means the Thai gloss is
 * normalised in one place rather than six.
 */
export function WordChips({
    words,
    columns = 2,
}: {
    words: OxfordWord[];
    /** 1 for a narrow column, 2 for a full-width section. */
    columns?: 1 | 2;
}) {
    if (words.length === 0) return null;

    return (
        <ul
            data-testid="word-chips"
            className={
                columns === 2 ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"
            }
        >
            {words.map((word) => (
                <li key={word.slug}>
                    <Link
                        href={`/english/words/${word.slug}`}
                        className="play-press flex items-baseline justify-between gap-3 rounded-2xl border-2 border-ink bg-white px-4 py-2 hover:bg-accent-mint"
                    >
                        <span className="font-extrabold text-ink">{word.displayWord}</span>
                        <span className="text-sm text-muted-foreground">
                            {normaliseThai(word.meaningTh)}
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

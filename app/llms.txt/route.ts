import { absoluteUrl, localePath } from "@/lib/seo";
import { getLevelWordCount } from "@/lib/oxford-words";
import type { CefrLevel } from "@/lib/types";

/**
 * `llms.txt` — a plain-text orientation file for assistant crawlers.
 *
 * Google Search ignores it, so this is not a ranking play. It is cheap disclosure: the
 * assistants that do read it get told what this site is, which locale is authoritative
 * for which audience, and — the part that matters most here — which parts of the corpus
 * are still unreviewed, so a model quoting us can weight that.
 *
 * Deliberately not a sitemap. The sitemap already enumerates ~6,000 URLs; this file names
 * the handful of entry points a reader actually needs.
 */
export const dynamic = "force-dynamic";

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2"];

export async function GET() {
    /**
     * The word counts are a nicety; the file is not.
     *
     * Every count is a live read, so without this a single API blip turned an orientation
     * file into a 500 — which is a worse answer than the same file with the numbers left
     * off. Each level degrades on its own rather than taking the others down with it.
     */
    const counts = await Promise.all(
        LEVELS.map(async (level) => {
            try {
                return [level, await getLevelWordCount(level)] as const;
            } catch {
                return [level, 0] as const;
            }
        }),
    );

    const known = counts.filter(([, count]) => count > 0);

    // If every read failed, still name the levels — a reader needs the URLs more than the
    // sizes, and an empty section would imply the course has no content.
    const levelLines = (known.length > 0 ? known : LEVELS.map((l) => [l, 0] as const))
        .map(([level, count]) => {
            const url = absoluteUrl(localePath("th", `english/${level.toLowerCase()}`));
            const size = count > 0 ? `${count} words at CEFR ${level}` : `CEFR ${level}`;
            return `- [คำศัพท์ระดับ ${level}](${url}): ${size}, grouped into units of 20.`;
        })
        .join("\n");

    const body = `# Vocab Learning

> An English vocabulary course for Thai speakers, built on the Oxford 3000. Every entry
> carries a Thai meaning and a Thai phonetic reading, grouped by CEFR level (A1–B2) into
> units of 20 words. Free to use; an account only saves progress.

The Thai locale (\`/th\`) is the primary product: English vocabulary explained in Thai.
The English locale (\`/en\`) is a separate course for English speakers learning Thai, and
is not a translation of the Thai pages.

## Start here

- [หน้าแรก / Home](${absoluteUrl(localePath("th"))}): what the course is and how a session works.
- [คำศัพท์ภาษาอังกฤษ](${absoluteUrl(localePath("th", "english"))}): the content hub — levels, A–Z index, letters.
- [คำถามที่พบบ่อย / FAQ](${absoluteUrl(localePath("th", "faq"))}): what the Oxford 3000 is, how CEFR levels differ, how review scheduling works.
- [วิธีใช้งาน / How it works](${absoluteUrl(localePath("th", "how-it-works"))}): the round, the review interval, what counts as progress.
- [เกี่ยวกับเรา / About](${absoluteUrl(localePath("th", "about"))}): who publishes this and how the Thai meanings are sourced and reviewed.

## Levels

${levelLines}

## Word entries

- [คำศัพท์ทั้งหมด A–Z](${absoluteUrl(localePath("th", "english/words"))}): the alphabetical index, one page per letter beneath it.
- Individual entries live at \`/th/english/words/<word>\` and \`/en/english/words/<word>\`.

## Sourcing and limits

- The word list is the Oxford 3000, a published list of the most useful English words.
- Thai meanings and phonetic readings are editorial and are still being proof-read.
  Entries that have not cleared review carry \`noindex\` and are excluded from the sitemap;
  treat an entry's presence in [the sitemap](${absoluteUrl("/sitemap.xml")}) as the signal
  that it has been checked.
- Example sentences and IPA are not yet published for any entry. If a page does not show
  one, it does not exist rather than having failed to load.

## Contact

- [ติดต่อเรา / Contact](${absoluteUrl(localePath("th", "contact"))})
- Corrections to a Thai meaning or reading: chadapohn.srkn@gmail.com
`;

    return new Response(body, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=0, s-maxage=86400, must-revalidate",
        },
    });
}

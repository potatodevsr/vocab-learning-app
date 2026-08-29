/**
 * The English sounds Thai speakers systematically lose (SEO-CONTENT §U).
 *
 * Editorial content, so it lives here rather than in D1 (SEO-CONTENT §3.1): it is prose
 * about the *language*, not data about a word, and a copy edit should be a code review
 * rather than a two-repo migration. Both locales are required at the type level for the
 * same reason topic names are — these strings end up in `<title>`, and an untranslated
 * Thai value is a bug (AGENTS.md rule 3).
 *
 * `examples` are slugs that must already exist in the published corpus. They are
 * hand-picked rather than pulled by a spelling regex, because spelling does not decide
 * sound: `think` and `this` both begin `th` and are different consonants, and a page that
 * gets that wrong teaches the mistake it exists to fix. The page filters to the slugs the
 * API actually returns, so a word that is later withdrawn drops out instead of 404ing, and
 * a sound left with fewer than `MIN_EXAMPLES` renders `noindex, follow`.
 *
 * Everything here needs a native review pass before it can be called finished — it is
 * drafted content, in the same sense `backend/pnpm gen:examples` produces drafts.
 */

import type { PronunciationSlug } from "@/lib/routes";

export type LocalisedText = { en: string; th: string };

export type SoundGuide = {
    /** URL slug — stable, English, lowercase. Typed against `lib/routes.ts`, which is
     *  what middleware checks, so a slug that exists in one and not the other cannot compile. */
    slug: PronunciationSlug;
    /** How the sound is written in IPA, or the spelling pattern when that is the subject. */
    symbol: string;
    title: LocalisedText;
    /** One sentence. Seeds the meta description, so it has to stand alone. */
    summary: LocalisedText;
    /** Why this one is hard for a Thai speaker specifically. */
    why: LocalisedText;
    /** What to do with the mouth. Concrete, physical instructions only. */
    how: LocalisedText;
    /** The substitution to listen for in your own speech. */
    watch: LocalisedText;
    /** Published slugs that contain the sound. Verified against the corpus. */
    examples: string[];
};

export const SOUND_GUIDES: SoundGuide[] = [
    {
        slug: "th-voiceless",
        symbol: "/θ/",
        title: {
            en: "The /θ/ sound — think, three, month",
            th: "เสียง /θ/ — think, three, month",
        },
        summary: {
            en: "Thai has no /θ/, so it usually arrives as t or s. The fix is the tongue between the teeth, not behind them.",
            th: "ภาษาไทยไม่มีเสียง /θ/ คนไทยจึงมักออกเป็น ท หรือ ส วิธีแก้คือวางลิ้นไว้ระหว่างฟัน ไม่ใช่หลังฟัน",
        },
        why: {
            en: "Thai has no sound made with the tongue between the teeth, so the ear reaches for the nearest thing it knows — /t/ or /s/. That turns think into tink or sink, and both are real words, which is why the mistake survives so long: nobody asks you to repeat yourself.",
            th: "ภาษาไทยไม่มีเสียงที่ออกโดยเอาลิ้นไว้ระหว่างฟัน หูจึงเลือกเสียงที่ใกล้ที่สุดที่รู้จัก คือ ท หรือ ส ทำให้ think กลายเป็น tink หรือ sink ซึ่งทั้งสองคำมีอยู่จริงในภาษาอังกฤษ ความผิดนี้จึงอยู่กับเรานาน เพราะไม่มีใครขอให้พูดซ้ำ",
        },
        how: {
            en: "Put the tip of your tongue lightly against the bottom of your top teeth, so a little of it shows. Blow air out over it without using your voice. There is no puff of t and no hiss of s — only air escaping over the tongue.",
            th: "วางปลายลิ้นแตะขอบล่างของฟันบนเบา ๆ ให้เห็นปลายลิ้นนิดหนึ่ง แล้วเป่าลมออกผ่านลิ้นโดยไม่ใช้เสียงจากลำคอ ไม่มีเสียงระเบิดแบบ ท และไม่มีเสียงเสียดแบบ ส มีแค่ลมที่ผ่านลิ้นออกมา",
        },
        watch: {
            en: "Say three, then tree. If they sound the same, your tongue is still behind your teeth.",
            th: "ลองพูด three แล้วพูด tree ถ้าฟังเหมือนกัน แปลว่าลิ้นยังอยู่หลังฟันอยู่",
        },
        examples: ["think", "three", "thing", "through", "thousand", "throw", "thin", "health", "month", "both", "south", "north", "nothing", "strength"],
    },
    {
        slug: "th-voiced",
        symbol: "/ð/",
        title: {
            en: "The /ð/ sound — the, this, other",
            th: "เสียง /ð/ — the, this, other",
        },
        summary: {
            en: "The same tongue position as /θ/, but with the voice switched on. It is the most frequent consonant in English and the easiest to skip.",
            th: "ตำแหน่งลิ้นเหมือน /θ/ แต่เปิดเสียงจากลำคอด้วย เป็นพยัญชนะที่พบบ่อยที่สุดในภาษาอังกฤษ และเป็นเสียงที่ถูกข้ามบ่อยที่สุด",
        },
        why: {
            en: "This is the sound in the, that, they and other — the words you say most often. Thai speakers usually replace it with /d/, so the becomes duh and they becomes day. Because these are function words nobody misunderstands you, so the habit sets hard.",
            th: "เสียงนี้อยู่ในคำว่า the, that, they, other ซึ่งเป็นคำที่ใช้บ่อยที่สุด คนไทยมักแทนด้วยเสียง ด ทำให้ the กลายเป็น เดอะ และ they กลายเป็น เดย์ เพราะเป็นคำเชื่อมที่ไม่มีใครฟังผิด นิสัยนี้จึงติดแน่นมาก",
        },
        how: {
            en: "Start from /θ/ — tongue tip touching the top teeth — and hum while the air passes. Put a hand on your throat: for /ð/ it vibrates, for /θ/ it does not.",
            th: "เริ่มจากท่า /θ/ คือปลายลิ้นแตะฟันบน แล้วออกเสียงจากลำคอไปพร้อมกับลมที่ผ่านออกมา ลองเอามือแตะลำคอ ถ้าเป็น /ð/ จะรู้สึกสั่น ถ้าเป็น /θ/ จะไม่สั่น",
        },
        watch: {
            en: "If the sounds like เดอะ with a full ด at the front, the tongue never left the ridge behind your teeth.",
            th: "ถ้า the ออกมาเป็น เดอะ ที่มีเสียง ด เต็ม ๆ นำหน้า แปลว่าลิ้นยังไม่ได้ออกมาจากปุ่มเหงือกหลังฟัน",
        },
        examples: ["they", "there", "then", "than", "other", "another", "together", "weather", "mother", "brother", "although", "though", "whether", "without"],
    },
    {
        slug: "v-sound",
        symbol: "/v/",
        title: {
            en: "The /v/ sound — very, love, give",
            th: "เสียง /v/ — very, love, give",
        },
        summary: {
            en: "Thai has no /v/, so it becomes /w/ at the start of a word and disappears at the end.",
            th: "ภาษาไทยไม่มีเสียง /v/ ต้นคำจึงกลายเป็น ว และท้ายคำมักหายไปเลย",
        },
        why: {
            en: "Thai borrows English v as ว, so very becomes wery and van becomes wan. At the end of a word it is worse: love and live lose the consonant entirely, because Thai does not end a syllable with a friction sound.",
            th: "ภาษาไทยยืมเสียง v มาเป็น ว ทำให้ very กลายเป็น wery และ van กลายเป็น wan ท้ายคำยิ่งหนักกว่า เพราะ love กับ live มักหายเสียงท้ายไปทั้งหมด เนื่องจากภาษาไทยไม่ลงท้ายพยางค์ด้วยเสียงเสียดแทรก",
        },
        how: {
            en: "Rest your top teeth on your bottom lip and hum. The lips never close and never round — if they round, you have said /w/. At the end of a word the teeth still have to touch the lip, even if the sound is short.",
            th: "วางฟันบนบนริมฝีปากล่าง แล้วออกเสียงให้สั่น ริมฝีปากต้องไม่ปิดสนิทและไม่ห่อ ถ้าห่อเมื่อไรจะกลายเป็นเสียง ว ส่วนท้ายคำ ฟันก็ยังต้องแตะริมฝีปากเหมือนเดิม แม้เสียงจะสั้นก็ตาม",
        },
        watch: {
            en: "Record yourself saying very well. If both words start the same way, the first one is wrong.",
            th: "ลองอัดเสียงตัวเองพูด very well ถ้าสองคำนี้ขึ้นต้นเหมือนกัน แปลว่าคำแรกยังผิดอยู่",
        },
        examples: ["very", "give", "love", "leave", "move", "have", "never", "over", "value", "visit", "voice", "seven", "travel", "average"],
    },
    {
        slug: "z-sound",
        symbol: "/z/",
        title: {
            en: "The /z/ sound — zero, easy, is",
            th: "เสียง /z/ — zero, easy, is",
        },
        summary: {
            en: "Thai has /s/ but not /z/, so the buzz at the end of is, was and has goes missing.",
            th: "ภาษาไทยมีเสียง ส แต่ไม่มีเสียง /z/ เสียงก้องท้ายคำอย่าง is, was, has จึงหายไป",
        },
        why: {
            en: "Every plural, every possessive and every third-person verb in English can end in /z/, so this is not one word — it is a grammar ending. Thai turns it into /s/ or drops it, and dogs, his and knows all lose their last sound.",
            th: "คำพหูพจน์ คำแสดงความเป็นเจ้าของ และกริยาบุรุษที่สามในภาษาอังกฤษ ล้วนลงท้ายด้วยเสียง /z/ ได้ นี่จึงไม่ใช่แค่คำเดียว แต่เป็นเสียงท้ายที่บอกไวยากรณ์ ภาษาไทยเปลี่ยนเป็น ส หรือตัดทิ้ง ทำให้ dogs, his, knows หายเสียงท้ายไปหมด",
        },
        how: {
            en: "Say a long /s/, then keep the tongue exactly where it is and switch your voice on. The hiss becomes a buzz. Hold it for two seconds so your ear learns the difference.",
            th: "ออกเสียง ส ยาว ๆ แล้วคงลิ้นไว้ที่เดิม เปิดเสียงจากลำคอเพิ่มเข้าไป เสียงลมจะกลายเป็นเสียงสั่น ลองลากค้างไว้สักสองวินาทีให้หูจำความต่างได้",
        },
        watch: {
            en: "Say price and prize back to back. Same word except the last sound — if you hear no difference, the buzz is missing.",
            th: "ลองพูด price แล้ว prize ติดกัน สองคำต่างกันแค่เสียงสุดท้าย ถ้าฟังไม่ต่าง แปลว่ายังไม่มีเสียงสั่น",
        },
        examples: ["zero", "easy", "busy", "season", "music", "always", "because", "choose", "design", "husband", "present", "rise", "lose", "size"],
    },
    {
        slug: "sh-sound",
        symbol: "/ʃ/",
        title: {
            en: "The /ʃ/ sound — she, wash, machine",
            th: "เสียง /ʃ/ — she, wash, machine",
        },
        summary: {
            en: "Close to Thai ช but made further back, with rounded lips. Thai speakers usually land on /s/ or ฉ.",
            th: "ใกล้เคียงเสียง ช ในภาษาไทย แต่ออกลึกกว่าและห่อปาก คนไทยมักออกเป็น ส หรือ ฉ แทน",
        },
        why: {
            en: "Thai has ฉ and ช, which are close but not the same: they start with the tongue touching, English /ʃ/ never touches at all. And Thai cannot end a syllable with it, so wash, finish and English itself lose their final sound.",
            th: "ภาษาไทยมี ฉ และ ช ซึ่งใกล้เคียงแต่ไม่เหมือน เพราะเสียงไทยเริ่มจากลิ้นแตะเพดาน ส่วน /ʃ/ ในภาษาอังกฤษลิ้นไม่แตะเลย และภาษาไทยลงท้ายพยางค์ด้วยเสียงนี้ไม่ได้ คำว่า wash, finish และ English จึงเสียเสียงท้ายไป",
        },
        how: {
            en: "Say /s/, then slide the tongue back about a centimetre and round your lips as if you were about to whistle. The air should feel wide, not narrow.",
            th: "ออกเสียง ส ก่อน แล้วเลื่อนลิ้นถอยหลังประมาณหนึ่งเซนติเมตร พร้อมห่อริมฝีปากเหมือนกำลังจะผิวปาก ลมที่ออกมาควรรู้สึกกว้าง ไม่ใช่แคบ",
        },
        watch: {
            en: "See and she should not sound the same. If they do, the tongue has not moved back.",
            th: "see กับ she ต้องไม่เหมือนกัน ถ้าเหมือนกัน แปลว่าลิ้นยังไม่ได้ถอยไปข้างหลัง",
        },
        examples: ["she", "shop", "show", "share", "machine", "finish", "wash", "station", "national", "special", "social", "sure", "fish", "push"],
    },
    {
        slug: "ch-and-j",
        symbol: "/tʃ/ · /dʒ/",
        title: {
            en: "/tʃ/ and /dʒ/ — church and job",
            th: "เสียง /tʃ/ และ /dʒ/ — church และ job",
        },
        summary: {
            en: "Thai has the ch sound but not its voiced partner, so job, judge and change come out as chop, chudge and chain-ch.",
            th: "ภาษาไทยมีเสียง ช แต่ไม่มีคู่ที่ก้องของมัน คำว่า job, judge, change จึงออกมาเป็นเสียง ช ทั้งหมด",
        },
        why: {
            en: "/dʒ/ is /tʃ/ with the voice on, and Thai has no such consonant. So job sounds like chop, and the difference between cheap and jeep disappears. English also ends words with both, which Thai does not do at all.",
            th: "เสียง /dʒ/ ก็คือ /tʃ/ ที่เปิดเสียงก้อง ซึ่งภาษาไทยไม่มีพยัญชนะแบบนี้ job จึงฟังเหมือน chop และความต่างระหว่าง cheap กับ jeep ก็หายไป นอกจากนี้ภาษาอังกฤษยังลงท้ายคำด้วยเสียงทั้งสองนี้ได้ ซึ่งภาษาไทยไม่มีเลย",
        },
        how: {
            en: "Start with ช. For /dʒ/, hum through it — hand on the throat, it must vibrate from the very first moment, not after. Practise the pair cheap–jeep until you can hear which one you said.",
            th: "เริ่มจากเสียง ช สำหรับ /dʒ/ ให้ออกเสียงก้องไปพร้อมกัน เอามือแตะลำคอ ต้องรู้สึกสั่นตั้งแต่จังหวะแรก ไม่ใช่สั่นทีหลัง ลองฝึกคู่คำ cheap กับ jeep จนแยกออกว่าตัวเองพูดคำไหน",
        },
        watch: {
            en: "If job and chop sound alike, you are switching the voice on too late.",
            th: "ถ้า job กับ chop ฟังเหมือนกัน แปลว่าคุณเปิดเสียงก้องช้าเกินไป",
        },
        examples: ["change", "choose", "teach", "watch", "church", "cheap", "job", "join", "just", "large", "manage", "village", "judge", "journey"],
    },
    {
        slug: "r-and-l",
        symbol: "/r/ · /l/",
        title: {
            en: "/r/ and /l/ — right and light",
            th: "เสียง /r/ และ /l/ — right และ light",
        },
        summary: {
            en: "Thai has both sounds, and everyday Thai speech merges them. English never does.",
            th: "ภาษาไทยมีทั้งสองเสียง แต่ภาษาพูดในชีวิตประจำวันมักรวมเป็นเสียงเดียว ภาษาอังกฤษไม่รวมเลย",
        },
        why: {
            en: "This one is not a missing sound — it is a habit. Thai ร and ล are separate letters, but casual speech turns ร into ล, and the habit carries straight into English, where right/light and collect/correct are different words.",
            th: "เรื่องนี้ไม่ใช่เสียงที่ขาดหายไป แต่เป็นความเคยชิน ตัว ร และ ล ในภาษาไทยเป็นคนละตัวอักษร แต่ภาษาพูดมักเปลี่ยน ร เป็น ล และความเคยชินนี้ติดมาถึงภาษาอังกฤษ ซึ่ง right กับ light และ collect กับ correct เป็นคนละคำ",
        },
        how: {
            en: "For /l/ the tongue tip touches the ridge behind your top teeth and stays there. For English /r/ it touches nothing at all — pull the tongue back and slightly up, and let the sound come out around it.",
            th: "เสียง /l/ ปลายลิ้นต้องแตะปุ่มเหงือกหลังฟันบนแล้วค้างไว้ ส่วนเสียง /r/ ในภาษาอังกฤษ ลิ้นไม่แตะอะไรเลย ให้ดึงลิ้นถอยหลังและยกขึ้นเล็กน้อย แล้วปล่อยเสียงออกรอบ ๆ ลิ้น",
        },
        watch: {
            en: "English /r/ is not a rolled ร. If your tongue taps, you are speaking Thai.",
            th: "เสียง /r/ ในภาษาอังกฤษไม่ใช่เสียง ร รัวลิ้น ถ้าลิ้นกระดกแตะเมื่อไร แปลว่ากำลังพูดแบบไทยอยู่",
        },
        examples: ["result", "report", "relate", "local", "level", "early", "clearly", "similar", "library", "later", "leader", "little", "love", "lucky"],
    },
    {
        slug: "final-l",
        symbol: "-l",
        title: {
            en: "The /l/ at the end — call, well, school",
            th: "เสียง /l/ ท้ายคำ — call, well, school",
        },
        summary: {
            en: "Thai turns a final l into n or a vowel, so call becomes can and school becomes sakoon.",
            th: "ภาษาไทยเปลี่ยนเสียง l ท้ายคำเป็น น หรือกลืนเป็นสระ call จึงกลายเป็น can และ school กลายเป็น สะกูน",
        },
        why: {
            en: "Thai allows only eight final consonants and /l/ is not one of them — a borrowed word ending in l is spoken with น. So call sounds like can, and email, hotel and school all end in the wrong place.",
            th: "ภาษาไทยมีตัวสะกดได้เพียงแปดมาตรา และไม่มีเสียง l อยู่ในนั้น คำยืมที่ลงท้ายด้วย l จึงออกเสียงเป็น น ทำให้ call ฟังเหมือน can และ email, hotel, school ก็ลงท้ายผิดไปหมด",
        },
        how: {
            en: "Finish the word with the tongue tip still touching the ridge behind your top teeth, and let the sound stop there. Do not open the mouth afterwards — that is what adds the extra vowel.",
            th: "จบคำโดยให้ปลายลิ้นยังแตะปุ่มเหงือกหลังฟันบนอยู่ แล้วปล่อยให้เสียงหยุดตรงนั้น อย่าอ้าปากต่อ เพราะการอ้าปากคือสิ่งที่ทำให้เกิดเสียงสระเกินมา",
        },
        watch: {
            en: "Say well, then hold the last sound for a second. If you hear น, the tongue is in the wrong place.",
            th: "ลองพูด well แล้วลากเสียงสุดท้ายค้างไว้หนึ่งวินาที ถ้าได้ยินเสียง น แปลว่าลิ้นอยู่ผิดที่",
        },
        examples: ["call", "school", "still", "until", "people", "little", "travel", "email", "hotel", "control", "usual", "final", "level", "local"],
    },
    {
        slug: "final-s",
        symbol: "-s / -es",
        title: {
            en: "The -s ending — books, watches, days",
            th: "เสียงท้าย -s — books, watches, days",
        },
        summary: {
            en: "One spelling, three sounds — /s/, /z/ and /ɪz/ — and Thai drops all three.",
            th: "เขียนแบบเดียว แต่ออกเสียงได้สามแบบ คือ /s/, /z/ และ /ɪz/ ซึ่งคนไทยมักตัดทิ้งทั้งสามแบบ",
        },
        why: {
            en: "Thai marks plurals with a separate word, never with a sound stuck on the end, so the ending feels optional. It is not: it is the difference between one book and two, and between I work and he works.",
            th: "ภาษาไทยบอกพหูพจน์ด้วยคำแยกต่างหาก ไม่เคยใช้เสียงต่อท้าย เสียงนี้จึงรู้สึกเหมือนไม่จำเป็น แต่จริง ๆ แล้วจำเป็น เพราะมันคือความต่างระหว่างหนังสือเล่มเดียวกับสองเล่ม และระหว่าง I work กับ he works",
        },
        how: {
            en: "After a voiceless sound (p, t, k, f) say /s/: books, cats. After a voiced sound or a vowel say /z/: days, dogs. After s, z, ch, sh, ge add a whole syllable /ɪz/: watches, changes.",
            th: "ถ้าเสียงหน้าเป็นเสียงไม่ก้อง (p, t, k, f) ให้ออก /s/ เช่น books, cats ถ้าเสียงหน้าเป็นเสียงก้องหรือสระ ให้ออก /z/ เช่น days, dogs และถ้าเสียงหน้าเป็น s, z, ch, sh, ge ให้เพิ่มเป็นพยางค์ /ɪz/ เช่น watches, changes",
        },
        watch: {
            en: "Read a sentence aloud and count the -s endings you actually pronounced. Most learners find they said none of them.",
            th: "ลองอ่านประโยคออกเสียงแล้วนับว่าออกเสียงท้าย -s ไปกี่ครั้ง ผู้เรียนส่วนใหญ่จะพบว่าไม่ได้ออกเลยสักครั้ง",
        },
        examples: ["book", "day", "year", "thing", "watch", "change", "place", "house", "work", "hour", "word", "parent", "student", "class"],
    },
    {
        slug: "ed-endings",
        symbol: "-ed",
        title: {
            en: "The -ed ending — worked, played, wanted",
            th: "เสียงท้าย -ed — worked, played, wanted",
        },
        summary: {
            en: "Three sounds again: /t/, /d/ and a full extra syllable /ɪd/. Only the last one is spelled the way it sounds.",
            th: "อีกครั้งกับสามเสียง คือ /t/, /d/ และพยางค์เพิ่มเต็ม ๆ /ɪd/ มีเพียงแบบสุดท้ายเท่านั้นที่ออกเสียงตรงกับตัวเขียน",
        },
        why: {
            en: "Most learners read -ed as a syllable everywhere — work-ed, play-ed — which is wrong twice over: it adds a beat that is not there and it hides the two endings that are. English past tense lives in this ending; drop it and every sentence is present tense.",
            th: "ผู้เรียนส่วนใหญ่อ่าน -ed เป็นพยางค์ทุกครั้ง เช่น work-ed, play-ed ซึ่งผิดสองต่อ คือเพิ่มจังหวะที่ไม่มี และกลบเสียงจริงสองแบบที่มี รูปอดีตของภาษาอังกฤษอยู่ที่เสียงท้ายนี้ ถ้าตัดทิ้ง ทุกประโยคก็จะกลายเป็นปัจจุบันหมด",
        },
        how: {
            en: "After a voiceless sound say /t/ with no extra beat: worked, asked, watched. After a voiced sound or vowel say /d/: played, lived, called. Only after t or d does it become a syllable: wanted, needed, started.",
            th: "ถ้าเสียงหน้าเป็นเสียงไม่ก้อง ให้ออกเป็น /t/ โดยไม่เพิ่มพยางค์ เช่น worked, asked, watched ถ้าเสียงหน้าเป็นเสียงก้องหรือสระ ให้ออกเป็น /d/ เช่น played, lived, called และจะกลายเป็นพยางค์เพิ่มก็ต่อเมื่อเสียงหน้าเป็น t หรือ d เท่านั้น เช่น wanted, needed, started",
        },
        watch: {
            en: "Clap once per syllable. Worked is one clap. If you clapped twice, you added a beat English does not have.",
            th: "ลองตบมือหนึ่งครั้งต่อหนึ่งพยางค์ คำว่า worked ต้องได้หนึ่งครั้ง ถ้าตบสองครั้ง แปลว่าเพิ่มจังหวะที่ภาษาอังกฤษไม่มี",
        },
        examples: ["work", "ask", "watch", "move", "call", "want", "need", "start", "decide", "visit", "happen", "open", "finish", "turn"],
    },
    {
        slug: "final-stops",
        symbol: "-p -t -k -b -d -g",
        title: {
            en: "Final stops — back, hat, big",
            th: "เสียงหยุดท้ายคำ — back, hat, big",
        },
        summary: {
            en: "Thai stops the air and holds it; English lets it go. And Thai has no voiced final stop at all.",
            th: "ภาษาไทยกักลมไว้ไม่ปล่อย ส่วนภาษาอังกฤษปล่อยลมออก และภาษาไทยไม่มีตัวสะกดที่เป็นเสียงก้องเลย",
        },
        why: {
            en: "Thai final k, p and t are unreleased — the air stops behind the closure. English releases them, faintly but audibly. Worse, Thai has no final b, d or g, so big becomes bik and bad becomes bat, which changes the word.",
            th: "ตัวสะกด ก ป ต ในภาษาไทยเป็นเสียงไม่ปล่อยลม ลมจะหยุดค้างอยู่ในปาก ส่วนภาษาอังกฤษปล่อยลมออกเบา ๆ แต่ได้ยิน ที่หนักกว่านั้นคือภาษาไทยไม่มีตัวสะกด b, d, g ทำให้ big กลายเป็น bik และ bad กลายเป็น bat ซึ่งเปลี่ยนความหมายไปเลย",
        },
        how: {
            en: "Finish the word, then let a small breath escape — no vowel after it, just air. For b, d and g keep your voice on right up to the closure; the vowel before them is also noticeably longer than before p, t and k.",
            th: "พูดคำให้จบ แล้วปล่อยลมออกเบา ๆ อย่าให้มีเสียงสระตามมา ให้เป็นแค่ลม สำหรับ b, d, g ต้องคงเสียงก้องไว้จนถึงจังหวะที่ปิดปาก และสระที่อยู่ข้างหน้าก็จะยาวกว่าสระหน้า p, t, k อย่างชัดเจน",
        },
        watch: {
            en: "Say bad and bat. The vowel in bad should be clearly longer. If both are short, the final consonant is the same one.",
            th: "ลองพูด bad แล้ว bat สระในคำว่า bad ต้องยาวกว่าอย่างชัดเจน ถ้าสั้นเท่ากันทั้งคู่ แปลว่าเสียงท้ายยังเป็นเสียงเดียวกันอยู่",
        },
        examples: ["black", "book", "take", "hat", "great", "night", "big", "bad", "job", "head", "side", "cold", "word", "bed"],
    },
    {
        slug: "initial-clusters",
        symbol: "sp- st- sk- str-",
        title: {
            en: "Clusters at the start — stop, spring, street",
            th: "พยัญชนะควบต้นคำ — stop, spring, street",
        },
        summary: {
            en: "Thai has no /s/ + consonant opening, so a vowel gets inserted: sa-top, sa-pring.",
            th: "ภาษาไทยไม่มีการขึ้นต้นด้วย ส ตามด้วยพยัญชนะ จึงมีสระแทรกเข้ามา เช่น สะ-ต็อป สะ-ปริง",
        },
        why: {
            en: "Thai syllables cannot begin with s followed by another consonant, so the mouth solves the problem by adding a vowel — and the word gains a syllable it does not have. Street becomes sa-ta-reet: three beats instead of one.",
            th: "พยางค์ในภาษาไทยขึ้นต้นด้วย ส ตามด้วยพยัญชนะอีกตัวไม่ได้ ปากจึงแก้ปัญหาด้วยการเติมสระเข้าไป แล้วคำก็ได้พยางค์เกินมา street กลายเป็น สะ-ตะ-รีท คือสามจังหวะ แทนที่จะเป็นจังหวะเดียว",
        },
        how: {
            en: "Say the /s/ long first — ssss — then attach the rest without stopping. Keep the whole thing on one beat. Practise slowly at first: ssss-top, then stop.",
            th: "ออกเสียง ส ลาก ๆ ก่อน แล้วต่อส่วนที่เหลือทันทีโดยไม่หยุด ให้ทั้งคำอยู่ในจังหวะเดียว ฝึกช้า ๆ ก่อน เช่น สสส-ต็อป แล้วค่อยรวบเป็น stop",
        },
        watch: {
            en: "Count the beats in student. English says two. Most Thai speakers say three.",
            th: "ลองนับจังหวะในคำว่า student ภาษาอังกฤษมีสองจังหวะ แต่คนไทยส่วนใหญ่ออกเป็นสามจังหวะ",
        },
        examples: ["stop", "start", "study", "student", "state", "story", "space", "speak", "special", "sport", "skill", "street", "strong", "spring"],
    },
    {
        slug: "final-clusters",
        symbol: "-sk -st -kt -nts",
        title: {
            en: "Clusters at the end — asked, texts, months",
            th: "พยัญชนะควบท้ายคำ — asked, texts, months",
        },
        summary: {
            en: "Thai allows exactly one final consonant. English allows four in a row.",
            th: "ภาษาไทยมีตัวสะกดได้แค่ตัวเดียว ส่วนภาษาอังกฤษมีเรียงกันได้ถึงสี่เสียง",
        },
        why: {
            en: "A Thai syllable ends with one sound and stops. English piles them up — asked is /askt/, texts is /teksts/ — so the usual outcome is that everything after the first consonant is dropped, and with it the tense and the plural.",
            th: "พยางค์ไทยลงท้ายด้วยเสียงเดียวแล้วจบ ส่วนภาษาอังกฤษเรียงต่อกันได้ เช่น asked เป็น /askt/ และ texts เป็น /teksts/ ผลที่มักเกิดขึ้นคือเสียงหลังตัวแรกหายไปหมด และรูปกาลกับพหูพจน์ก็หายไปด้วย",
        },
        how: {
            en: "Build it backwards. Say the last sound alone, then add one sound in front at a time: t, kt, skt, askt. Do it slowly — speed is what makes the ending collapse.",
            th: "ฝึกจากท้ายไปหน้า ออกเสียงตัวสุดท้ายเดี่ยว ๆ ก่อน แล้วค่อยเติมทีละเสียงข้างหน้า เช่น t, kt, skt, askt ทำช้า ๆ เพราะความเร็วคือสาเหตุที่ทำให้เสียงท้ายพัง",
        },
        watch: {
            en: "If asked and ask sound identical, the past tense is not being heard.",
            th: "ถ้า asked กับ ask ฟังเหมือนกัน แปลว่าผู้ฟังไม่ได้ยินรูปอดีตเลย",
        },
        examples: ["ask", "test", "first", "most", "against", "act", "result", "accept", "expect", "object", "subject", "important", "instead", "almost"],
    },
    {
        slug: "ae-and-e",
        symbol: "/æ/ · /e/",
        title: {
            en: "/æ/ and /e/ — bad and bed",
            th: "สระ /æ/ และ /e/ — bad และ bed",
        },
        summary: {
            en: "Thai แ and เ are close, but English puts the two vowels closer still, and the mouth has to open wider than feels natural.",
            th: "สระ แ และ เ ในภาษาไทยใกล้เคียงกันอยู่แล้ว แต่ภาษาอังกฤษวางสองเสียงนี้ใกล้กันยิ่งกว่า และต้องอ้าปากกว้างกว่าที่รู้สึกว่าเป็นธรรมชาติ",
        },
        why: {
            en: "Thai แ maps onto /æ/ fairly well, but learners often use เ for both, so bad and bed, man and men, sad and said stop being different words. The pair is common enough that it changes meaning several times a paragraph.",
            th: "สระ แ ในภาษาไทยเทียบกับ /æ/ ได้ค่อนข้างดี แต่ผู้เรียนมักใช้ เ กับทั้งสองเสียง ทำให้ bad กับ bed, man กับ men, sad กับ said ไม่ต่างกันอีกต่อไป คู่เสียงนี้พบบ่อยมากจนเปลี่ยนความหมายได้หลายครั้งในย่อหน้าเดียว",
        },
        how: {
            en: "For /æ/ drop your jaw as if starting a yawn and keep the tongue low and forward — wider than Thai แ. For /e/ the jaw is half as open. Say them alternately until your jaw feels the difference without your ear.",
            th: "สำหรับ /æ/ ให้ลดขากรรไกรลงเหมือนกำลังจะหาว และวางลิ้นต่ำไปทางหน้า อ้ากว้างกว่าสระ แ ของไทย ส่วน /e/ อ้าปากประมาณครึ่งเดียว ลองสลับพูดสองเสียงจนขากรรไกรรู้สึกถึงความต่างได้เองโดยไม่ต้องใช้หู",
        },
        watch: {
            en: "Man and men in the same sentence. If your jaw does not move between them, they are the same vowel.",
            th: "ลองพูด man กับ men ในประโยคเดียวกัน ถ้าขากรรไกรไม่ขยับเลย แปลว่าเป็นสระเดียวกันอยู่",
        },
        examples: ["happy", "have", "hand", "happen", "black", "man", "answer", "activity", "end", "enter", "help", "tell", "send", "several"],
    },
    {
        slug: "schwa",
        symbol: "/ə/",
        title: {
            en: "The schwa /ə/ — about, problem, computer",
            th: "สระกลาง /ə/ — about, problem, computer",
        },
        summary: {
            en: "The most common vowel in English is the one with no colour at all, and Thai speakers pronounce it too clearly.",
            th: "สระที่พบบ่อยที่สุดในภาษาอังกฤษคือสระที่แทบไม่มีสีเสียงเลย แต่คนไทยมักออกเสียงมันชัดเกินไป",
        },
        why: {
            en: "Every unstressed syllable in English tends toward /ə/ — the a in about, the o in problem, the er in computer are all the same weak sound. Thai gives every syllable equal weight, so English spoken with Thai rhythm sounds spelled-out rather than spoken.",
            th: "พยางค์ที่ไม่ลงน้ำหนักในภาษาอังกฤษมักกลายเป็นเสียง /ə/ ทั้งหมด เช่น a ใน about, o ใน problem และ er ใน computer ล้วนเป็นเสียงอ่อนเสียงเดียวกัน ภาษาไทยให้น้ำหนักทุกพยางค์เท่ากัน ภาษาอังกฤษที่พูดด้วยจังหวะไทยจึงฟังเหมือนอ่านสะกดคำมากกว่าพูด",
        },
        how: {
            en: "Relax the mouth completely and make the shortest, laziest sound you can — that is the target. Then say the word with the stressed syllable loud and long, and everything else fast and weak.",
            th: "ผ่อนปากให้สบายที่สุด แล้วออกเสียงที่สั้นและขี้เกียจที่สุดเท่าที่ทำได้ นั่นคือเสียงที่ต้องการ จากนั้นพูดทั้งคำโดยให้พยางค์ที่ลงน้ำหนักดังและยาว ส่วนพยางค์อื่นเร็วและเบา",
        },
        watch: {
            en: "Say computer. If all three syllables are equally loud, none of them is the stressed one.",
            th: "ลองพูด computer ถ้าทั้งสามพยางค์ดังเท่ากัน แปลว่าไม่มีพยางค์ไหนเป็นพยางค์ที่ลงน้ำหนักเลย",
        },
        examples: ["about", "again", "around", "another", "person", "computer", "together", "national", "important", "different", "support", "account", "teacher", "water"],
    },
    {
        slug: "long-and-short-i",
        symbol: "/iː/ · /ɪ/",
        title: {
            en: "/iː/ and /ɪ/ — sheep and ship",
            th: "สระ /iː/ และ /ɪ/ — sheep และ ship",
        },
        summary: {
            en: "Thai already has long and short vowels, so this one is winnable — but the short English /ɪ/ is not just a shorter /iː/.",
            th: "ภาษาไทยมีสระสั้นสระยาวอยู่แล้ว เสียงคู่นี้จึงฝึกได้ไม่ยาก แต่ /ɪ/ สั้นในภาษาอังกฤษไม่ใช่แค่ /iː/ ที่สั้นลง",
        },
        why: {
            en: "Thai อี and อิ differ in length only. English /ɪ/ differs in length and in tongue position — it is lower and more relaxed. Using a short อิ for it gets you halfway, which is why ship and sheep still sound alike to a listener.",
            th: "สระ อี กับ อิ ในภาษาไทยต่างกันแค่ความยาว แต่ /ɪ/ ในภาษาอังกฤษต่างทั้งความยาวและตำแหน่งลิ้น คือต่ำกว่าและผ่อนคลายกว่า การใช้ อิ สั้นแทนจึงถูกแค่ครึ่งเดียว และนั่นคือเหตุผลที่ ship กับ sheep ยังฟังเหมือนกันสำหรับผู้ฟัง",
        },
        how: {
            en: "For /iː/ smile and push the tongue high and forward, and hold it. For /ɪ/ relax the smile, let the tongue drop a little, and cut it short. The relaxation matters more than the length.",
            th: "สำหรับ /iː/ ให้ยิ้มกว้าง ดันลิ้นขึ้นสูงไปข้างหน้า แล้วลากเสียง ส่วน /ɪ/ ให้ผ่อนรอยยิ้ม ปล่อยลิ้นลงเล็กน้อย และตัดเสียงให้สั้น ความผ่อนคลายสำคัญกว่าความยาว",
        },
        watch: {
            en: "This one is worth practising as a pair rather than alone — say live and leave, fit and feet, one after the other.",
            th: "เสียงคู่นี้ควรฝึกเป็นคู่มากกว่าฝึกเดี่ยว ลองพูด live กับ leave และ fit กับ feet สลับกันไปมา",
        },
        examples: ["ship", "sheep", "sit", "seat", "feel", "big", "believe", "little", "meeting", "busy", "between", "clean", "keep", "sleep"],
    },
    {
        slug: "word-stress",
        symbol: "•",
        title: {
            en: "Word stress — which syllable is loud",
            th: "การลงน้ำหนักคำ — พยางค์ไหนต้องดัง",
        },
        summary: {
            en: "English words have one strong syllable and the rest are weak. Get it wrong and a perfectly pronounced word is still not understood.",
            th: "คำในภาษาอังกฤษมีพยางค์ที่ลงน้ำหนักเพียงพยางค์เดียว ที่เหลือเป็นพยางค์เบา ถ้าลงน้ำหนักผิด คำที่ออกเสียงถูกทุกตัวก็ยังฟังไม่รู้เรื่อง",
        },
        why: {
            en: "Thai has tone on every syllable and no stress; English has stress and no tone. English listeners find a word by its stress pattern first, so PHOtograph said as phoTOgraph is heard as a different word — or as no word at all.",
            th: "ภาษาไทยมีวรรณยุกต์ทุกพยางค์แต่ไม่มีการลงน้ำหนัก ส่วนภาษาอังกฤษมีการลงน้ำหนักแต่ไม่มีวรรณยุกต์ ผู้ฟังภาษาอังกฤษจะจำคำจากรูปแบบการลงน้ำหนักก่อน คำว่า PHOtograph ถ้าออกเป็น phoTOgraph จะถูกได้ยินเป็นคำอื่น หรือไม่เป็นคำเลย",
        },
        how: {
            en: "Say the stressed syllable louder, longer and higher, and make everything else short and quiet. Two-syllable nouns usually stress the first; two-syllable verbs usually the second — REcord the noun, reCORD the verb.",
            th: "ออกเสียงพยางค์ที่ลงน้ำหนักให้ดังขึ้น ยาวขึ้น และสูงขึ้น ส่วนพยางค์อื่นให้สั้นและเบา คำนามสองพยางค์มักลงน้ำหนักพยางค์แรก ส่วนคำกริยาสองพยางค์มักลงพยางค์ที่สอง เช่น REcord เป็นคำนาม และ reCORD เป็นคำกริยา",
        },
        watch: {
            en: "Tap the table on the strong syllable while you say the word. If you cannot decide where to tap, you have not learned the word yet.",
            th: "ลองเคาะโต๊ะตรงพยางค์ที่ลงน้ำหนักขณะพูดคำนั้น ถ้าตัดสินใจไม่ได้ว่าจะเคาะตรงไหน แปลว่ายังไม่ได้จำคำนั้นจริง ๆ",
        },
        examples: ["about", "because", "before", "between", "important", "different", "produce", "record", "present", "increase", "photograph", "computer", "understand", "information"],
    },
    {
        slug: "silent-letters",
        symbol: "—",
        title: {
            en: "Letters you do not say — know, hour, listen",
            th: "ตัวอักษรที่ไม่ออกเสียง — know, hour, listen",
        },
        summary: {
            en: "English spelling keeps letters it stopped pronouncing centuries ago, and reading them aloud is a Thai-speaker habit worth breaking early.",
            th: "การสะกดภาษาอังกฤษยังเก็บตัวอักษรที่เลิกออกเสียงไปหลายร้อยปีแล้ว การอ่านออกเสียงตามตัวสะกดเป็นนิสัยของผู้เรียนไทยที่ควรเลิกตั้งแต่เนิ่น ๆ",
        },
        why: {
            en: "Thai is written close to the way it sounds, so the instinct is to trust the spelling. English does not reward that: the k in know, the h in hour, the t in listen and the b in climb are all silent, and pronouncing them marks a speaker instantly.",
            th: "ภาษาไทยเขียนใกล้เคียงกับเสียงที่ออก สัญชาตญาณจึงบอกให้เชื่อตัวสะกด แต่ภาษาอังกฤษไม่เป็นแบบนั้น ตัว k ใน know ตัว h ใน hour ตัว t ใน listen และตัว b ใน climb ล้วนไม่ออกเสียง การออกเสียงมันจะทำให้ผู้ฟังรู้ทันที",
        },
        how: {
            en: "Learn the word by ear before you learn it by eye. When you meet a new spelling, say it out loud once from the pronunciation column here, then read the spelling back — that order stops the eye from teaching the mouth.",
            th: "จำคำจากเสียงก่อนจำจากตัวเขียน เมื่อเจอคำใหม่ ให้พูดออกเสียงหนึ่งครั้งตามคำอ่านในหน้านี้ก่อน แล้วค่อยกลับไปอ่านตัวสะกด ลำดับแบบนี้จะกันไม่ให้สายตาสอนปากผิด",
        },
        watch: {
            en: "If you can hear a k at the front of know, the spelling is still driving.",
            th: "ถ้ายังได้ยินเสียง k อยู่หน้าคำว่า know แปลว่าตัวสะกดยังเป็นคนขับอยู่",
        },
        examples: ["know", "knowledge", "hour", "honest", "listen", "write", "wrong", "climb", "half", "talk", "walk", "island", "answer", "sign"],
    },
];

export const soundBySlug = (slug: string): SoundGuide | undefined =>
    SOUND_GUIDES.find((guide) => guide.slug === slug);

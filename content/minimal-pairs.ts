import type { MinimalPairSlug, PronunciationSlug } from "@/lib/routes";
import type { LocalisedText } from "@/content/pronunciation";

/**
 * Minimal pairs — two English words separated by one sound (SEO-CONTENT §V).
 *
 * Deliberately **not** family K. K is meaning confusion (`affect` / `effect`); this is
 * sound confusion, and for a Thai speaker the two are different problems with different
 * queries behind them. A learner who says `sheep` for `ship` has not misunderstood a
 * definition — they have merged two vowels their first language does not separate.
 *
 * Each pair names the `contrast` guides it illustrates, and the page pulls its word lists
 * from those. That is what keeps a pair page over the substance floor without padding: the
 * evidence is the published corpus, and it is different evidence on every page.
 *
 * `slug` is the two words in alphabetical order joined by `-vs-`, so a pair has exactly one
 * address and can never compete with itself (the rule family K sets in SEO-CONTENT §4/K).
 *
 * `corpus` is the slug of the word page, when the word is published here. Several of these
 * words are not in the Oxford 3000 — `tree`, `jeep`, `grass` — and that is fine: the pair is
 * still the right thing to teach, the word simply does not get a link. Never invent a slug
 * to make a link appear.
 *
 * Drafted content. It needs a native review pass before anyone calls it finished.
 */

type PairWord = {
    word: string;
    /** The published word page, when there is one. */
    corpus?: string;
    /** American English, matching the corpus (`oxford-3000-american`). */
    ipa: string;
};

export type MinimalPair = {
    slug: MinimalPairSlug;
    a: PairWord;
    b: PairWord;
    /** The sound guides this pair is evidence for. One or two. */
    contrast: PronunciationSlug[];
    /** Why these two collapse into one for a Thai speaker. Two or three sentences. */
    note: LocalisedText;
    /** `en` is the English sentence; `th` is its Thai translation. */
    sentenceA: LocalisedText;
    sentenceB: LocalisedText;
};

export const MINIMAL_PAIRS: MinimalPair[] = [
    {
        slug: "advice-vs-advise",
        a: { word: "advice", corpus: "advice", ipa: "/ədˈvaɪs/" },
        b: { word: "advise", corpus: "advise", ipa: "/ədˈvaɪz/" },
        contrast: ["z-sound"],
        note: {
            en: "One letter apart in spelling, one sound apart in speech: advice ends in a hiss, advise ends in a buzz. The noun is the /s/ and the verb is the /z/, so losing the buzz turns a verb into a noun.",
            th: "ต่างกันตัวเดียวในการเขียน และต่างกันเสียงเดียวในการพูด advice ลงท้ายด้วยเสียงลม ส่วน advise ลงท้ายด้วยเสียงสั่น คำนามคือ /s/ และคำกริยาคือ /z/ ถ้าเสียงสั่นหายไป คำกริยาก็จะกลายเป็นคำนาม",
        },
        sentenceA: {
            en: "Can you give me some advice?",
            th: "ขอคำแนะนำหน่อยได้ไหม",
        },
        sentenceB: {
            en: "Doctors advise us to sleep more.",
            th: "หมอแนะนำให้เรานอนมากขึ้น",
        },
    },
    {
        slug: "bad-vs-bed",
        a: { word: "bad", corpus: "bad", ipa: "/bæd/" },
        b: { word: "bed", corpus: "bed", ipa: "/bed/" },
        contrast: ["ae-and-e", "final-stops"],
        note: {
            en: "The vowel in bad needs a wider jaw than any Thai vowel a learner reaches for first. Say them one after the other with a hand under your chin — if your jaw does not drop for bad, both words are bed.",
            th: "สระในคำว่า bad ต้องอ้าปากกว้างกว่าสระไทยที่ผู้เรียนมักหยิบมาใช้เป็นอันดับแรก ลองพูดสลับกันโดยเอามือรองไว้ใต้คาง ถ้าคางไม่ตกลงตอนพูด bad แปลว่าทั้งสองคำคือ bed",
        },
        sentenceA: {
            en: "The weather was bad all week.",
            th: "อากาศแย่มาตลอดทั้งสัปดาห์",
        },
        sentenceB: {
            en: "She sat on the bed and read.",
            th: "เธอนั่งบนเตียงแล้วอ่านหนังสือ",
        },
    },
    {
        slug: "ban-vs-van",
        a: { word: "ban", corpus: "ban", ipa: "/bæn/" },
        b: { word: "van", corpus: "van", ipa: "/væn/" },
        contrast: ["v-sound"],
        note: {
            en: "Thai has no /v/, so learners reach for either /b/ or /w/. For van the top teeth must touch the bottom lip; for ban the lips close on each other and the teeth are not involved at all.",
            th: "ภาษาไทยไม่มีเสียง /v/ ผู้เรียนจึงมักหยิบเสียง บ หรือ ว มาใช้แทน คำว่า van ต้องเอาฟันบนแตะริมฝีปากล่าง ส่วน ban ริมฝีปากปิดชนกันเอง โดยไม่ใช้ฟันเลย",
        },
        sentenceA: {
            en: "The city may ban cars in the old town.",
            th: "เมืองอาจห้ามรถยนต์เข้าในย่านเมืองเก่า",
        },
        sentenceB: {
            en: "We moved the boxes in a van.",
            th: "เราขนกล่องด้วยรถตู้",
        },
    },
    {
        slug: "beat-vs-bit",
        a: { word: "beat", corpus: "beat", ipa: "/biːt/" },
        b: { word: "bit", corpus: "bit", ipa: "/bɪt/" },
        contrast: ["long-and-short-i"],
        note: {
            en: "Thai already separates long and short vowels, so this pair is winnable — but English /ɪ/ is not just a short /iː/, it is also more relaxed and slightly lower. Keep the smile for beat and drop it for bit.",
            th: "ภาษาไทยแยกสระสั้นสระยาวอยู่แล้ว คู่นี้จึงฝึกได้ แต่เสียง /ɪ/ ในภาษาอังกฤษไม่ใช่แค่ /iː/ ที่สั้นลง มันผ่อนคลายกว่าและต่ำกว่าเล็กน้อยด้วย ให้ยิ้มค้างไว้ตอนพูด beat และผ่อนรอยยิ้มตอนพูด bit",
        },
        sentenceA: {
            en: "Our team beat theirs by two points.",
            th: "ทีมของเราชนะทีมเขาไปสองแต้ม",
        },
        sentenceB: {
            en: "I only need a bit of help.",
            th: "ฉันต้องการความช่วยเหลือแค่นิดเดียว",
        },
    },
    {
        slug: "boat-vs-vote",
        a: { word: "boat", corpus: "boat", ipa: "/boʊt/" },
        b: { word: "vote", corpus: "vote", ipa: "/voʊt/" },
        contrast: ["v-sound"],
        note: {
            en: "Same vowel, same ending — the whole difference is the first consonant. Boat closes both lips; vote rests the top teeth on the bottom lip and lets the sound buzz through.",
            th: "สระเหมือนกัน เสียงท้ายเหมือนกัน ต่างกันแค่พยัญชนะตัวแรก คำว่า boat ริมฝีปากปิดชนกัน ส่วน vote ให้ฟันบนวางบนริมฝีปากล่างแล้วปล่อยเสียงสั่นผ่านออกมา",
        },
        sentenceA: {
            en: "We took a boat across the river.",
            th: "เรานั่งเรือข้ามแม่น้ำ",
        },
        sentenceB: {
            en: "Everyone over eighteen can vote.",
            th: "ทุกคนที่อายุเกินสิบแปดปีมีสิทธิ์ลงคะแนนเสียง",
        },
    },
    {
        slug: "cat-vs-cut",
        a: { word: "cat", corpus: "cat", ipa: "/kæt/" },
        b: { word: "cut", corpus: "cut", ipa: "/kʌt/" },
        contrast: ["ae-and-e"],
        note: {
            en: "For cat the tongue is forward and the mouth is wide; for cut the tongue sits in the middle and the mouth is relaxed and almost closed. Thai แ works for the first one, but there is no Thai vowel that lands neatly on the second.",
            th: "คำว่า cat ลิ้นอยู่ข้างหน้าและอ้าปากกว้าง ส่วน cut ลิ้นอยู่กลางปากและปากผ่อนคลายเกือบปิด สระ แ ของไทยใช้กับคำแรกได้ แต่ไม่มีสระไทยตัวไหนตรงกับคำที่สองพอดี",
        },
        sentenceA: {
            en: "The cat slept on my chair.",
            th: "แมวนอนอยู่บนเก้าอี้ของฉัน",
        },
        sentenceB: {
            en: "Please cut the paper in half.",
            th: "ช่วยตัดกระดาษออกเป็นครึ่งหนึ่ง",
        },
    },
    {
        slug: "cheap-vs-jeep",
        a: { word: "cheap", corpus: "cheap", ipa: "/tʃiːp/" },
        b: { word: "jeep", ipa: "/dʒiːp/" },
        contrast: ["ch-and-j"],
        note: {
            en: "Thai has the ch sound but not its voiced partner, so jeep usually comes out as cheap. Put a hand on your throat: for jeep it has to vibrate from the very first moment, not after the vowel starts.",
            th: "ภาษาไทยมีเสียง ช แต่ไม่มีคู่ที่ก้องของมัน คำว่า jeep จึงมักออกมาเป็น cheap ลองเอามือแตะลำคอ ถ้าเป็น jeep ต้องรู้สึกสั่นตั้งแต่จังหวะแรก ไม่ใช่หลังจากสระเริ่มแล้ว",
        },
        sentenceA: {
            en: "The tickets were surprisingly cheap.",
            th: "ตั๋วราคาถูกอย่างน่าประหลาดใจ",
        },
        sentenceB: {
            en: "They drove an old jeep up the hill.",
            th: "พวกเขาขับรถจี๊ปคันเก่าขึ้นเนินเขา",
        },
    },
    {
        slug: "close-vs-clothes",
        a: { word: "close", corpus: "close-1", ipa: "/kloʊz/" },
        b: { word: "clothes", corpus: "clothes", ipa: "/kloʊðz/" },
        contrast: ["th-voiced", "final-clusters"],
        note: {
            en: "Clothes ends in three consonants with no vowel between them, which no Thai syllable does, so the ending collapses and the word becomes close. Say the /ð/ quickly but do not skip it.",
            th: "คำว่า clothes ลงท้ายด้วยพยัญชนะสามเสียงติดกันโดยไม่มีสระคั่น ซึ่งพยางค์ไทยไม่มีแบบนี้ เสียงท้ายจึงพังและคำกลายเป็น close ให้ออกเสียง /ð/ เร็ว ๆ แต่อย่าข้ามมันไป",
        },
        sentenceA: {
            en: "Please close the door behind you.",
            th: "ช่วยปิดประตูตามหลังคุณด้วย",
        },
        sentenceB: {
            en: "I put my clothes in the bag.",
            th: "ฉันเอาเสื้อผ้าใส่ในกระเป๋า",
        },
    },
    {
        slug: "coast-vs-cost",
        a: { word: "coast", corpus: "coast", ipa: "/koʊst/" },
        b: { word: "cost", corpus: "cost", ipa: "/kɔːst/" },
        contrast: ["final-clusters"],
        note: {
            en: "Coast has a long vowel that glides — /oʊ/ — while cost has a single, shorter one. Both end in the same two-consonant cluster, so the ending is not what tells them apart; the vowel is.",
            th: "คำว่า coast มีสระยาวที่เลื่อนเสียง คือ /oʊ/ ส่วน cost มีสระเดี่ยวที่สั้นกว่า ทั้งสองคำลงท้ายด้วยพยัญชนะควบสองเสียงเหมือนกัน เสียงท้ายจึงไม่ใช่ตัวแยก แต่เป็นสระต่างหาก",
        },
        sentenceA: {
            en: "We drove along the coast for an hour.",
            th: "เราขับรถเลียบชายฝั่งอยู่หนึ่งชั่วโมง",
        },
        sentenceB: {
            en: "How much does the ticket cost?",
            th: "ตั๋วราคาเท่าไร",
        },
    },
    {
        slug: "coat-vs-court",
        a: { word: "coat", corpus: "coat", ipa: "/koʊt/" },
        b: { word: "court", corpus: "court", ipa: "/kɔːrt/" },
        contrast: ["r-and-l"],
        note: {
            en: "Court carries an /r/ that colours the whole vowel; coat has no /r/ at all. Thai has no r-coloured vowel, so the two words arrive as one unless the tongue pulls back for court.",
            th: "คำว่า court มีเสียง /r/ ที่ทำให้สระทั้งเสียงเปลี่ยนไป ส่วน coat ไม่มีเสียง /r/ เลย ภาษาไทยไม่มีสระที่มีเสียง ร ผสม สองคำนี้จึงกลายเป็นคำเดียวกัน เว้นแต่จะดึงลิ้นถอยหลังตอนพูด court",
        },
        sentenceA: {
            en: "Take a coat — it is cold outside.",
            th: "เอาเสื้อโค้ทไปด้วย ข้างนอกหนาว",
        },
        sentenceB: {
            en: "The case went to court last year.",
            th: "คดีนี้ขึ้นศาลเมื่อปีที่แล้ว",
        },
    },
    {
        slug: "collect-vs-correct",
        a: { word: "collect", corpus: "collect", ipa: "/kəˈlekt/" },
        b: { word: "correct", corpus: "correct", ipa: "/kəˈrekt/" },
        contrast: ["r-and-l"],
        note: {
            en: "Everyday Thai speech merges ร into ล, and the habit follows straight into English — where these are two different words in the same sentence position. For /l/ the tongue tip touches and stays; for /r/ it touches nothing.",
            th: "ภาษาพูดไทยในชีวิตประจำวันมักเปลี่ยน ร เป็น ล และความเคยชินนี้ตามมาถึงภาษาอังกฤษ ซึ่งสองคำนี้เป็นคนละคำที่วางในตำแหน่งเดียวกันได้ เสียง /l/ ปลายลิ้นแตะแล้วค้างไว้ ส่วนเสียง /r/ ลิ้นไม่แตะอะไรเลย",
        },
        sentenceA: {
            en: "I collect old coins.",
            th: "ฉันสะสมเหรียญเก่า",
        },
        sentenceB: {
            en: "Only one answer is correct.",
            th: "มีคำตอบที่ถูกต้องเพียงข้อเดียว",
        },
    },
    {
        slug: "day-vs-they",
        a: { word: "day", corpus: "day", ipa: "/deɪ/" },
        b: { word: "they", corpus: "they", ipa: "/ðeɪ/" },
        contrast: ["th-voiced"],
        note: {
            en: "They is the single most useful word in this family, and it is the one most often said as day. The tongue has to come out to the teeth — behind them is /d/, between them is /ð/.",
            th: "คำว่า they เป็นคำที่ใช้บ่อยที่สุดในกลุ่มนี้ และเป็นคำที่ถูกออกเสียงเป็น day บ่อยที่สุด ลิ้นต้องออกมาที่ฟัน ถ้าอยู่หลังฟันจะเป็นเสียง /d/ ถ้าอยู่ระหว่างฟันจะเป็นเสียง /ð/",
        },
        sentenceA: {
            en: "It rained every day last week.",
            th: "สัปดาห์ที่แล้วฝนตกทุกวัน",
        },
        sentenceB: {
            en: "They arrived before us.",
            th: "พวกเขามาถึงก่อนเรา",
        },
    },
    {
        slug: "eat-vs-it",
        a: { word: "eat", corpus: "eat", ipa: "/iːt/" },
        b: { word: "it", corpus: "it", ipa: "/ɪt/" },
        contrast: ["long-and-short-i"],
        note: {
            en: "These two appear in the same sentence constantly — eat it — so a learner who cannot separate them says the same syllable twice. Long and smiling, then short and relaxed.",
            th: "สองคำนี้อยู่ในประโยคเดียวกันบ่อยมาก เช่น eat it ผู้เรียนที่แยกไม่ออกจึงพูดพยางค์เดิมสองครั้ง ให้ออกเสียงแรกยาวและยิ้ม แล้วเสียงที่สองสั้นและผ่อนคลาย",
        },
        sentenceA: {
            en: "We usually eat at seven.",
            th: "ปกติเรากินข้าวตอนเจ็ดโมง",
        },
        sentenceB: {
            en: "Put it on the table.",
            th: "วางมันไว้บนโต๊ะ",
        },
    },
    {
        slug: "fly-vs-fry",
        a: { word: "fly", corpus: "fly", ipa: "/flaɪ/" },
        b: { word: "fry", ipa: "/fraɪ/" },
        contrast: ["r-and-l"],
        note: {
            en: "A cluster makes the /r/–/l/ contrast harder, because the tongue is already busy with the /f/. Slow it right down: fuh-lie and fuh-rye, then speed up without letting them merge.",
            th: "พยัญชนะควบทำให้แยกเสียง /r/ กับ /l/ ยากขึ้น เพราะลิ้นต้องจัดการเสียง /f/ อยู่แล้ว ให้ฝึกช้ามาก ๆ ก่อน เช่น เฟอะ-ลาย และ เฟอะ-ราย แล้วค่อยเร่งความเร็วโดยไม่ให้สองเสียงรวมกัน",
        },
        sentenceA: {
            en: "Birds fly south in winter.",
            th: "นกบินไปทางใต้ในฤดูหนาว",
        },
        sentenceB: {
            en: "Fry the eggs for two minutes.",
            th: "ทอดไข่สองนาที",
        },
    },
    {
        slug: "fool-vs-full",
        a: { word: "fool", ipa: "/fuːl/" },
        b: { word: "full", corpus: "full", ipa: "/fʊl/" },
        contrast: ["final-l", "long-and-short-i"],
        note: {
            en: "Two problems at once: a long-versus-short vowel, and a final /l/ that Thai turns into น. Finish both words with the tongue tip still touching the ridge behind your top teeth.",
            th: "มีปัญหาสองอย่างพร้อมกัน คือสระยาวกับสระสั้น และเสียง /l/ ท้ายคำที่ภาษาไทยเปลี่ยนเป็น น ให้จบทั้งสองคำโดยที่ปลายลิ้นยังแตะปุ่มเหงือกหลังฟันบนอยู่",
        },
        sentenceA: {
            en: "Do not make a fool of yourself.",
            th: "อย่าทำตัวเองให้ดูโง่",
        },
        sentenceB: {
            en: "The train was full this morning.",
            th: "เช้านี้รถไฟเต็ม",
        },
    },
    {
        slug: "free-vs-three",
        a: { word: "free", corpus: "free", ipa: "/friː/" },
        b: { word: "three", corpus: "three", ipa: "/θriː/" },
        contrast: ["th-voiceless"],
        note: {
            en: "Both start with air and no voice, so the ear has little to go on — the difference is where the air escapes. For free it passes between lip and teeth; for three it passes over the tongue tip between the teeth.",
            th: "ทั้งสองคำขึ้นต้นด้วยลมและไม่มีเสียงก้อง หูจึงแทบไม่มีอะไรให้จับ ความต่างอยู่ที่ตำแหน่งที่ลมออก คำว่า free ลมออกระหว่างริมฝีปากกับฟัน ส่วน three ลมออกผ่านปลายลิ้นที่อยู่ระหว่างฟัน",
        },
        sentenceA: {
            en: "The app is free to use.",
            th: "แอปนี้ใช้ได้ฟรี",
        },
        sentenceB: {
            en: "I have three sisters.",
            th: "ฉันมีพี่สาวน้องสาวสามคน",
        },
    },
    {
        slug: "glass-vs-grass",
        a: { word: "glass", corpus: "glass", ipa: "/ɡlæs/" },
        b: { word: "grass", ipa: "/ɡræs/" },
        contrast: ["r-and-l"],
        note: {
            en: "The same /r/–/l/ contrast, this time after a /ɡ/. Hold the first sound and change only the tongue: guh-lass, guh-rass. If your tongue taps, you are using Thai ร.",
            th: "เป็นการแยกเสียง /r/ กับ /l/ แบบเดียวกัน แต่คราวนี้ตามหลังเสียง /ɡ/ ให้ค้างเสียงแรกไว้แล้วเปลี่ยนเฉพาะลิ้น เช่น เกอะ-ลาส และ เกอะ-ราส ถ้าลิ้นกระดกแตะ แปลว่ากำลังใช้เสียง ร แบบไทย",
        },
        sentenceA: {
            en: "She poured water into a glass.",
            th: "เธอรินน้ำใส่แก้ว",
        },
        sentenceB: {
            en: "The grass is wet after the rain.",
            th: "หญ้าเปียกหลังฝนตก",
        },
    },
    {
        slug: "hard-vs-heart",
        a: { word: "hard", corpus: "hard", ipa: "/hɑːrd/" },
        b: { word: "heart", corpus: "heart", ipa: "/hɑːrt/" },
        contrast: ["final-stops"],
        note: {
            en: "Identical until the last sound, and Thai has no final /d/ at all, so both become heart. Listen to the vowel instead of the consonant: it is noticeably longer before /d/ than before /t/.",
            th: "เหมือนกันทุกอย่างจนถึงเสียงสุดท้าย และภาษาไทยไม่มีตัวสะกดเสียง /d/ เลย ทั้งสองคำจึงกลายเป็น heart ให้ฟังที่สระแทนที่จะฟังที่พยัญชนะ สระหน้าเสียง /d/ จะยาวกว่าสระหน้าเสียง /t/ อย่างชัดเจน",
        },
        sentenceA: {
            en: "The exam was hard but fair.",
            th: "ข้อสอบยากแต่ยุติธรรม",
        },
        sentenceB: {
            en: "He put a hand on his heart.",
            th: "เขาเอามือวางบนหัวใจตัวเอง",
        },
    },
    {
        slug: "hat-vs-hot",
        a: { word: "hat", corpus: "hat", ipa: "/hæt/" },
        b: { word: "hot", corpus: "hot", ipa: "/hɑːt/" },
        contrast: ["ae-and-e"],
        note: {
            en: "For hat the tongue is forward and the lips spread; for hot the tongue drops back and the mouth opens taller than it is wide. It helps to exaggerate both until the difference is obvious, then relax.",
            th: "คำว่า hat ลิ้นอยู่ข้างหน้าและริมฝีปากเหยียดออก ส่วน hot ลิ้นถอยลงไปข้างหลังและปากเปิดสูงมากกว่ากว้าง ลองออกเสียงเกินจริงทั้งสองคำจนความต่างชัดเจน แล้วค่อยผ่อนลง",
        },
        sentenceA: {
            en: "He wore a hat all summer.",
            th: "เขาใส่หมวกตลอดหน้าร้อน",
        },
        sentenceB: {
            en: "The soup is too hot to drink.",
            th: "ซุปร้อนเกินกว่าจะดื่มได้",
        },
    },
    {
        slug: "late-vs-let",
        a: { word: "late", corpus: "late", ipa: "/leɪt/" },
        b: { word: "let", corpus: "let", ipa: "/let/" },
        contrast: ["ae-and-e"],
        note: {
            en: "Late has a vowel that moves — it starts open and glides up — while let stays in one place. Thai เ‑ is close to the end of the glide, which is why late often loses its first half.",
            th: "คำว่า late มีสระที่เคลื่อนที่ คือเริ่มเปิดแล้วเลื่อนขึ้น ส่วน let อยู่กับที่ตำแหน่งเดียว สระ เ‑ ของไทยใกล้เคียงกับปลายของการเลื่อนนั้น คำว่า late จึงมักเสียครึ่งแรกของสระไป",
        },
        sentenceA: {
            en: "Sorry I am late.",
            th: "ขอโทษที่มาสาย",
        },
        sentenceB: {
            en: "Let me try once more.",
            th: "ให้ฉันลองอีกครั้งนะ",
        },
    },
    {
        slug: "leave-vs-live",
        a: { word: "leave", corpus: "leave", ipa: "/liːv/" },
        b: { word: "live", corpus: "live-1", ipa: "/lɪv/" },
        contrast: ["long-and-short-i", "v-sound"],
        note: {
            en: "Two of the hardest things in one short word: the long-short vowel pair, and a final /v/ that Thai simply drops. If the word ends in a vowel, the teeth never reached the lip.",
            th: "รวมสองเรื่องที่ยากที่สุดไว้ในคำสั้น ๆ คำเดียว คือคู่สระยาวกับสระสั้น และเสียง /v/ ท้ายคำที่ภาษาไทยตัดทิ้ง ถ้าคำจบลงด้วยเสียงสระ แปลว่าฟันยังไม่ได้แตะริมฝีปากเลย",
        },
        sentenceA: {
            en: "We leave at six tomorrow.",
            th: "พรุ่งนี้เราออกเดินทางตอนหกโมง",
        },
        sentenceB: {
            en: "They live near the station.",
            th: "พวกเขาอาศัยอยู่ใกล้สถานี",
        },
    },
    {
        slug: "loose-vs-lose",
        a: { word: "loose", corpus: "loose", ipa: "/luːs/" },
        b: { word: "lose", corpus: "lose", ipa: "/luːz/" },
        contrast: ["z-sound"],
        note: {
            en: "Same vowel, different ending: a hiss for loose and a buzz for lose. Hold the final sound for two full seconds while touching your throat — one vibrates and one does not.",
            th: "สระเหมือนกัน แต่เสียงท้ายต่างกัน คำว่า loose ลงท้ายด้วยเสียงลม ส่วน lose ลงท้ายด้วยเสียงสั่น ลองลากเสียงท้ายค้างไว้สองวินาทีพร้อมเอามือแตะลำคอ จะมีคำหนึ่งสั่นและอีกคำหนึ่งไม่สั่น",
        },
        sentenceA: {
            en: "This shirt is too loose.",
            th: "เสื้อตัวนี้หลวมเกินไป",
        },
        sentenceB: {
            en: "Try not to lose your keys.",
            th: "พยายามอย่าทำกุญแจหาย",
        },
    },
    {
        slug: "pan-vs-pen",
        a: { word: "pan", corpus: "pan", ipa: "/pæn/" },
        b: { word: "pen", corpus: "pen", ipa: "/pen/" },
        contrast: ["ae-and-e"],
        note: {
            en: "The classic /æ/–/e/ pair, and the one worth practising first because both words are concrete: you can hold them. Wide jaw for pan, half-open for pen.",
            th: "เป็นคู่ /æ/ กับ /e/ แบบคลาสสิก และควรฝึกคู่นี้ก่อน เพราะทั้งสองคำเป็นสิ่งของที่จับต้องได้ ให้อ้าปากกว้างตอนพูด pan และอ้าครึ่งเดียวตอนพูด pen",
        },
        sentenceA: {
            en: "Heat the pan before you cook.",
            th: "อุ่นกระทะก่อนเริ่มทำอาหาร",
        },
        sentenceB: {
            en: "Can I borrow your pen?",
            th: "ขอยืมปากกาหน่อยได้ไหม",
        },
    },
    {
        slug: "pen-vs-pin",
        a: { word: "pen", corpus: "pen", ipa: "/pen/" },
        b: { word: "pin", corpus: "pin", ipa: "/pɪn/" },
        contrast: ["ae-and-e", "long-and-short-i"],
        note: {
            en: "Both vowels are short, so length is no help here — only tongue height is. For pen the tongue is lower and the jaw more open; for pin it is higher and the jaw nearly closed.",
            th: "สระทั้งสองตัวเป็นสระสั้น ความยาวจึงช่วยอะไรไม่ได้ สิ่งที่ช่วยได้คือระดับความสูงของลิ้น คำว่า pen ลิ้นต่ำกว่าและอ้าปากมากกว่า ส่วน pin ลิ้นสูงกว่าและปากเกือบปิด",
        },
        sentenceA: {
            en: "Sign here with a black pen.",
            th: "เซ็นตรงนี้ด้วยปากกาสีดำ",
        },
        sentenceB: {
            en: "She fixed the paper with a pin.",
            th: "เธอกลัดกระดาษไว้ด้วยเข็มหมุด",
        },
    },
    {
        slug: "play-vs-pray",
        a: { word: "play", ipa: "/pleɪ/" },
        b: { word: "pray", corpus: "pray", ipa: "/preɪ/" },
        contrast: ["r-and-l"],
        note: {
            en: "Another cluster pair, and one where the meanings are far enough apart that a listener cannot repair it from context. Keep the tongue tip on the ridge for play and off it entirely for pray.",
            th: "เป็นคู่พยัญชนะควบอีกคู่หนึ่ง และเป็นคู่ที่ความหมายห่างกันมากจนผู้ฟังเดาจากบริบทไม่ได้ ให้ปลายลิ้นแตะปุ่มเหงือกไว้ตอนพูด play และไม่แตะเลยตอนพูด pray",
        },
        sentenceA: {
            en: "The children play outside after school.",
            th: "เด็ก ๆ เล่นข้างนอกหลังเลิกเรียน",
        },
        sentenceB: {
            en: "They pray every morning.",
            th: "พวกเขาสวดมนต์ทุกเช้า",
        },
    },
    {
        slug: "price-vs-prize",
        a: { word: "price", corpus: "price", ipa: "/praɪs/" },
        b: { word: "prize", corpus: "prize", ipa: "/praɪz/" },
        contrast: ["z-sound"],
        note: {
            en: "The clearest test in the whole /s/–/z/ family, because everything before the last sound is identical. If you cannot hear which one you said, the buzz is missing.",
            th: "เป็นแบบทดสอบที่ชัดที่สุดในกลุ่มเสียง /s/ กับ /z/ เพราะทุกอย่างก่อนเสียงสุดท้ายเหมือนกันหมด ถ้าฟังไม่ออกว่าตัวเองพูดคำไหน แปลว่ายังไม่มีเสียงสั่น",
        },
        sentenceA: {
            en: "The price went up again.",
            th: "ราคาขึ้นอีกแล้ว",
        },
        sentenceB: {
            en: "She won first prize.",
            th: "เธอได้รางวัลที่หนึ่ง",
        },
    },
    {
        slug: "sale-vs-sell",
        a: { word: "sale", corpus: "sale", ipa: "/seɪl/" },
        b: { word: "sell", corpus: "sell", ipa: "/sel/" },
        contrast: ["ae-and-e", "final-l"],
        note: {
            en: "A gliding vowel against a single one, both ending in the /l/ Thai turns into น. Get the ending right first — with a proper final /l/ the vowel difference becomes much easier to hear.",
            th: "เป็นสระที่เลื่อนเสียงเทียบกับสระเดี่ยว และทั้งคู่ลงท้ายด้วยเสียง /l/ ที่ภาษาไทยเปลี่ยนเป็น น ให้แก้เสียงท้ายให้ถูกก่อน เมื่อออกเสียง /l/ ท้ายคำได้จริง ความต่างของสระจะฟังง่ายขึ้นมาก",
        },
        sentenceA: {
            en: "The shop has a sale this week.",
            th: "ร้านนี้ลดราคาสัปดาห์นี้",
        },
        sentenceB: {
            en: "They sell fruit at the market.",
            th: "พวกเขาขายผลไม้ที่ตลาด",
        },
    },
    {
        slug: "sea-vs-she",
        a: { word: "sea", corpus: "sea", ipa: "/siː/" },
        b: { word: "she", corpus: "she", ipa: "/ʃiː/" },
        contrast: ["sh-sound"],
        note: {
            en: "Thai has ส and ช but not the English /ʃ/, which sits between them: the tongue is further back than for /s/ and, unlike ช, never touches. Round your lips slightly for she.",
            th: "ภาษาไทยมี ส และ ช แต่ไม่มีเสียง /ʃ/ ของภาษาอังกฤษ ซึ่งอยู่ระหว่างสองเสียงนั้น คือลิ้นถอยหลังกว่าเสียง ส และไม่แตะเพดานเหมือน ช ให้ห่อริมฝีปากเล็กน้อยตอนพูด she",
        },
        sentenceA: {
            en: "We swam in the sea every day.",
            th: "เราว่ายน้ำในทะเลทุกวัน",
        },
        sentenceB: {
            en: "She works at the hospital.",
            th: "เธอทำงานที่โรงพยาบาล",
        },
    },
    {
        slug: "seat-vs-sit",
        a: { word: "seat", corpus: "seat", ipa: "/siːt/" },
        b: { word: "sit", corpus: "sit", ipa: "/sɪt/" },
        contrast: ["long-and-short-i"],
        note: {
            en: "A noun and a verb that appear in the same sentence — take a seat, please sit — so saying them alike is noticed. Smile and hold for seat; relax and cut short for sit.",
            th: "เป็นคำนามกับคำกริยาที่อยู่ในประโยคเดียวกันได้ เช่น take a seat และ please sit การออกเสียงเหมือนกันจึงสังเกตได้ง่าย ให้ยิ้มและลากเสียงตอนพูด seat แล้วผ่อนและตัดเสียงสั้นตอนพูด sit",
        },
        sentenceA: {
            en: "Is this seat free?",
            th: "ที่นั่งนี้ว่างไหม",
        },
        sentenceB: {
            en: "Please sit down.",
            th: "เชิญนั่งลง",
        },
    },
    {
        slug: "sheep-vs-ship",
        a: { word: "sheep", corpus: "sheep", ipa: "/ʃiːp/" },
        b: { word: "ship", corpus: "ship", ipa: "/ʃɪp/" },
        contrast: ["long-and-short-i"],
        note: {
            en: "The most famous pair in English pronunciation teaching, and it earns the reputation: the two words are unrelated, so context never rescues you. Long and tense, then short and relaxed.",
            th: "เป็นคู่คำที่โด่งดังที่สุดในการสอนออกเสียงภาษาอังกฤษ และก็สมกับชื่อเสียงจริง ๆ เพราะสองคำนี้ไม่เกี่ยวข้องกันเลย บริบทจึงช่วยไม่ได้ ให้ออกเสียงแรกยาวและตึง แล้วเสียงที่สองสั้นและผ่อนคลาย",
        },
        sentenceA: {
            en: "The farm keeps forty sheep.",
            th: "ฟาร์มแห่งนี้เลี้ยงแกะสี่สิบตัว",
        },
        sentenceB: {
            en: "The ship left the harbour at dawn.",
            th: "เรือออกจากท่าตอนรุ่งสาง",
        },
    },
    {
        slug: "side-vs-sign",
        a: { word: "side", corpus: "side", ipa: "/saɪd/" },
        b: { word: "sign", corpus: "sign", ipa: "/saɪn/" },
        contrast: ["final-stops"],
        note: {
            en: "Thai does end syllables with น, so sign is the easy half — side is the one that disappears, because Thai has no final /d/. Let a small breath out at the end of side.",
            th: "ภาษาไทยลงท้ายพยางค์ด้วย น ได้อยู่แล้ว คำว่า sign จึงเป็นครึ่งที่ง่าย ส่วน side คือคำที่หายไป เพราะภาษาไทยไม่มีตัวสะกดเสียง /d/ ให้ปล่อยลมออกเบา ๆ ตอนจบคำว่า side",
        },
        sentenceA: {
            en: "Write your name on this side.",
            th: "เขียนชื่อของคุณไว้ด้านนี้",
        },
        sentenceB: {
            en: "The sign says the shop is closed.",
            th: "ป้ายบอกว่าร้านปิดแล้ว",
        },
    },
    {
        slug: "sink-vs-think",
        a: { word: "sink", corpus: "sink", ipa: "/sɪŋk/" },
        b: { word: "think", corpus: "think", ipa: "/θɪŋk/" },
        contrast: ["th-voiceless"],
        note: {
            en: "Think is one of the most common verbs in English, and sink is a real word, so the mistake is never corrected by a listener. The tongue must come out between the teeth — nothing else changes.",
            th: "คำว่า think เป็นคำกริยาที่ใช้บ่อยที่สุดคำหนึ่งในภาษาอังกฤษ และ sink ก็เป็นคำที่มีอยู่จริง ผู้ฟังจึงไม่เคยแก้ให้ ลิ้นต้องออกมาระหว่างฟัน นอกนั้นไม่มีอะไรเปลี่ยน",
        },
        sentenceA: {
            en: "The boat began to sink.",
            th: "เรือเริ่มจม",
        },
        sentenceB: {
            en: "I think you are right.",
            th: "ฉันคิดว่าคุณพูดถูก",
        },
    },
    {
        slug: "tank-vs-thank",
        a: { word: "tank", corpus: "tank", ipa: "/tæŋk/" },
        b: { word: "thank", corpus: "thank", ipa: "/θæŋk/" },
        contrast: ["th-voiceless"],
        note: {
            en: "Thank you is probably the phrase you say most often in English, which makes this the highest-value /θ/ to fix. There is no puff of air behind the teeth — only air over the tongue.",
            th: "คำว่า thank you น่าจะเป็นวลีที่คุณพูดบ่อยที่สุดในภาษาอังกฤษ การแก้เสียง /θ/ ตัวนี้จึงคุ้มที่สุด อย่าให้มีลมระเบิดหลังฟัน ให้มีแค่ลมที่ผ่านลิ้นออกมา",
        },
        sentenceA: {
            en: "The tank holds two hundred litres.",
            th: "ถังนี้จุได้สองร้อยลิตร",
        },
        sentenceB: {
            en: "Thank you for waiting.",
            th: "ขอบคุณที่รอ",
        },
    },
    {
        slug: "thin-vs-tin",
        a: { word: "thin", corpus: "thin", ipa: "/θɪn/" },
        b: { word: "tin", ipa: "/tɪn/" },
        contrast: ["th-voiceless"],
        note: {
            en: "Say tin and feel the tongue tap the ridge behind your teeth. For thin it never touches that ridge at all — it comes forward to the teeth themselves and the air keeps flowing.",
            th: "ลองพูด tin แล้วสังเกตว่าลิ้นแตะปุ่มเหงือกหลังฟัน ส่วน thin ลิ้นไม่แตะปุ่มนั้นเลย แต่เลื่อนออกมาที่ตัวฟัน และลมยังไหลออกต่อเนื่อง",
        },
        sentenceA: {
            en: "Cut the bread into thin slices.",
            th: "หั่นขนมปังเป็นแผ่นบาง ๆ",
        },
        sentenceB: {
            en: "The beans come in a tin.",
            th: "ถั่วบรรจุมาในกระป๋อง",
        },
    },
    {
        slug: "three-vs-tree",
        a: { word: "three", corpus: "three", ipa: "/θriː/" },
        b: { word: "tree", ipa: "/triː/" },
        contrast: ["th-voiceless", "r-and-l"],
        note: {
            en: "A number against a noun, and numbers are exactly where being misheard costs something. Two things have to be right at once: the tongue between the teeth, and an /r/ that does not tap.",
            th: "เป็นตัวเลขเทียบกับคำนาม และตัวเลขคือจุดที่การฟังผิดสร้างความเสียหายจริง ต้องทำถูกสองอย่างพร้อมกัน คือเอาลิ้นไว้ระหว่างฟัน และออกเสียง /r/ โดยไม่กระดกลิ้น",
        },
        sentenceA: {
            en: "I will be there in three minutes.",
            th: "อีกสามนาทีฉันจะไปถึง",
        },
        sentenceB: {
            en: "There is a tree in front of the house.",
            th: "มีต้นไม้อยู่หน้าบ้าน",
        },
    },
    {
        slug: "vine-vs-wine",
        a: { word: "vine", ipa: "/vaɪn/" },
        b: { word: "wine", corpus: "wine", ipa: "/waɪn/" },
        contrast: ["v-sound"],
        note: {
            en: "This is the pair that shows the /v/–/w/ substitution most clearly, because both words exist and both are ordinary. Teeth on lip for vine; lips rounded and teeth uninvolved for wine.",
            th: "เป็นคู่ที่แสดงการแทนเสียง /v/ ด้วย /w/ ได้ชัดที่สุด เพราะทั้งสองคำมีอยู่จริงและใช้ทั่วไป คำว่า vine ให้ฟันแตะริมฝีปาก ส่วน wine ให้ห่อริมฝีปากโดยไม่ใช้ฟัน",
        },
        sentenceA: {
            en: "The vine grows along the wall.",
            th: "เถาไม้เลื้อยขึ้นไปตามกำแพง",
        },
        sentenceB: {
            en: "They ordered a glass of wine.",
            th: "พวกเขาสั่งไวน์หนึ่งแก้ว",
        },
    },
    {
        slug: "wait-vs-wet",
        a: { word: "wait", corpus: "wait", ipa: "/weɪt/" },
        b: { word: "wet", corpus: "wet", ipa: "/wet/" },
        contrast: ["ae-and-e"],
        note: {
            en: "A gliding vowel against a still one. Stretch wait until you can hear it move from one place to another; wet stays exactly where it started.",
            th: "เป็นสระที่เลื่อนเสียงเทียบกับสระที่อยู่นิ่ง ลองลากเสียง wait จนได้ยินว่ามันเคลื่อนจากตำแหน่งหนึ่งไปอีกตำแหน่งหนึ่ง ส่วน wet อยู่ที่เดิมตลอด",
        },
        sentenceA: {
            en: "Please wait outside the room.",
            th: "กรุณารออยู่นอกห้อง",
        },
        sentenceB: {
            en: "My shoes are wet.",
            th: "รองเท้าของฉันเปียก",
        },
    },
    {
        slug: "walk-vs-work",
        a: { word: "walk", corpus: "walk", ipa: "/wɔːk/" },
        b: { word: "work", corpus: "work", ipa: "/wɜːrk/" },
        contrast: ["r-and-l", "silent-letters"],
        note: {
            en: "Two traps in one pair: the l in walk is silent, and the vowel in work is coloured by an /r/ that Thai has no equivalent for. Neither word contains an /l/ sound at all.",
            th: "มีกับดักสองอย่างในคู่เดียว คือตัว l ในคำว่า walk ไม่ออกเสียง และสระในคำว่า work มีเสียง /r/ ผสมอยู่ ซึ่งภาษาไทยไม่มีเสียงเทียบเคียง ทั้งสองคำไม่มีเสียง /l/ อยู่เลย",
        },
        sentenceA: {
            en: "I walk to school every morning.",
            th: "ฉันเดินไปโรงเรียนทุกเช้า",
        },
        sentenceB: {
            en: "She starts work at nine.",
            th: "เธอเริ่มทำงานตอนเก้าโมง",
        },
    },
    {
        slug: "wash-vs-watch",
        a: { word: "wash", corpus: "wash", ipa: "/wɑːʃ/" },
        b: { word: "watch", corpus: "watch", ipa: "/wɑːtʃ/" },
        contrast: ["sh-sound", "ch-and-j"],
        note: {
            en: "Both end in sounds Thai cannot put at the end of a syllable, so both endings tend to vanish and the words merge. Watch begins its ending with the tongue touching; wash never touches at all.",
            th: "ทั้งสองคำลงท้ายด้วยเสียงที่ภาษาไทยใช้เป็นตัวสะกดไม่ได้ เสียงท้ายจึงมักหายไปและสองคำก็รวมกัน คำว่า watch เริ่มเสียงท้ายด้วยการเอาลิ้นแตะเพดาน ส่วน wash ลิ้นไม่แตะเลย",
        },
        sentenceA: {
            en: "Wash your hands before dinner.",
            th: "ล้างมือก่อนกินข้าวเย็น",
        },
        sentenceB: {
            en: "We watch a film every Friday.",
            th: "เราดูหนังกันทุกวันศุกร์",
        },
    },
    {
        slug: "white-vs-wide",
        a: { word: "white", corpus: "white", ipa: "/waɪt/" },
        b: { word: "wide", corpus: "wide", ipa: "/waɪd/" },
        contrast: ["final-stops"],
        note: {
            en: "Same vowel, and the ending is the only difference — /t/ against a /d/ Thai does not allow at the end of a syllable. The vowel before /d/ is longer, and that length is what a listener actually uses.",
            th: "สระเหมือนกัน ต่างกันแค่เสียงท้าย คือ /t/ เทียบกับ /d/ ซึ่งภาษาไทยใช้เป็นตัวสะกดไม่ได้ สระที่อยู่หน้าเสียง /d/ จะยาวกว่า และความยาวนี้เองคือสิ่งที่ผู้ฟังใช้แยกคำ",
        },
        sentenceA: {
            en: "He wore a white shirt.",
            th: "เขาใส่เสื้อเชิ้ตสีขาว",
        },
        sentenceB: {
            en: "The road is very wide here.",
            th: "ถนนตรงนี้กว้างมาก",
        },
    },
];

export const pairBySlug = (slug: string): MinimalPair | undefined =>
    MINIMAL_PAIRS.find((pair) => pair.slug === slug);

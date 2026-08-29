import type { PlanSlug } from "@/lib/routes";
import type { LocalisedText } from "@/content/pronunciation";
import type { CefrLevel } from "@/lib/types";

/**
 * Study plans (SEO-CONTENT §AA).
 *
 * The intent behind "ท่องศัพท์ 30 วัน" is not information, it is commitment: someone has
 * already decided to start and wants to be told what to do tomorrow. That makes this the
 * highest-converting family in the programme and the one that has to be honest — a plan
 * that promises 3,000 words in a month is the reason people stop after four days.
 *
 * Each plan names the levels it covers; the page derives every number from the published
 * corpus, so the pace shown is the real one rather than a marketing figure. The prose is
 * per plan, so the four pages are not four renderings of one page (SEO-CONTENT §2.2).
 */

export type StudyPlan = {
    slug: PlanSlug;
    days: number;
    /** The levels this plan works through, in order. */
    levels: CefrLevel[];
    title: LocalisedText;
    /** One sentence. Seeds the meta description. */
    summary: LocalisedText;
    /** Who the plan is for and what it assumes. */
    intro: LocalisedText;
    /** What to do when a day is missed — the part that decides whether a plan survives. */
    recovery: LocalisedText;
};

export const STUDY_PLANS: StudyPlan[] = [
    {
        slug: "7-days",
        days: 7,
        levels: ["A1"],
        title: { en: "The first week", th: "สัปดาห์แรก" },
        summary: {
            en: "One unit a day for seven days — enough to find out whether this fits your life before you promise it anything.",
            th: "วันละหนึ่งบท เป็นเวลาเจ็ดวัน มากพอจะรู้ว่าวิธีนี้เข้ากับชีวิตคุณไหม ก่อนจะให้สัญญาอะไรกับมัน",
        },
        intro: {
            en: "A week is not long enough to learn a language and it is exactly long enough to build the habit that does. This plan asks for one unit a day from the start of A1 — around ten minutes — and nothing else. If you finish the week, you have twenty words a day of evidence that the thirty-day plan is realistic for you.",
            th: "หนึ่งสัปดาห์ไม่พอจะเรียนรู้ภาษา แต่พอดีสำหรับสร้างนิสัยที่จะพาไปถึงตรงนั้น แผนนี้ขอแค่วันละหนึ่งบทจากต้นระดับ A1 ประมาณสิบนาที และไม่ขออะไรอีก ถ้าคุณจบสัปดาห์นี้ได้ คุณจะมีหลักฐานวันละยี่สิบคำว่าแผนสามสิบวันเป็นไปได้จริงสำหรับคุณ",
        },
        recovery: {
            en: "Miss a day and simply do the next unit tomorrow. Do not double up — a seven-day plan that becomes a two-hour Sunday is a plan you will not repeat.",
            th: "ถ้าพลาดไปหนึ่งวัน ก็แค่ทำบทถัดไปในวันพรุ่งนี้ อย่าทำชดเชยสองเท่า เพราะแผนเจ็ดวันที่กลายเป็นการนั่งเรียนสองชั่วโมงในวันอาทิตย์ คือแผนที่คุณจะไม่ทำซ้ำอีก",
        },
    },
    {
        slug: "30-days",
        days: 30,
        levels: ["A1"],
        title: { en: "A1 in a month", th: "จบ A1 ใน 30 วัน" },
        summary: {
            en: "The whole A1 level in thirty days — the beginner vocabulary that everything else is built on.",
            th: "เรียนระดับ A1 ทั้งหมดใน 30 วัน คือคำศัพท์พื้นฐานที่ทุกอย่างหลังจากนี้สร้างต่อจากมัน",
        },
        intro: {
            en: "A1 is the level that decides whether the rest is possible: it is the words that appear in every sentence, so knowing them badly slows down everything you read afterwards. Thirty days is a pace that fits around a job — under half an hour a day — and it ends with a level you can test rather than a feeling that you studied.",
            th: "ระดับ A1 คือระดับที่ตัดสินว่าเรื่องที่เหลือจะเป็นไปได้ไหม เพราะเป็นคำที่ปรากฏในทุกประโยค ถ้ารู้ไม่แน่น ทุกอย่างที่อ่านต่อจากนี้จะช้าไปหมด สามสิบวันเป็นจังหวะที่ทำควบคู่กับงานประจำได้ คือวันละไม่ถึงครึ่งชั่วโมง และจบด้วยระดับที่วัดผลได้ ไม่ใช่แค่ความรู้สึกว่าได้เรียนแล้ว",
        },
        recovery: {
            en: "If you fall three days behind, do not try to catch up — move your finish line three days later instead. The review system spaces words out for you, and cramming defeats the one mechanism that makes them stick.",
            th: "ถ้าตามหลังสามวัน อย่าพยายามเร่งตามให้ทัน ให้เลื่อนเส้นชัยออกไปสามวันแทน ระบบทบทวนจะเว้นระยะคำให้เอง และการอัดรวดเดียวจะทำลายกลไกเดียวที่ทำให้คำติดหัว",
        },
    },
    {
        slug: "60-days",
        days: 60,
        levels: ["A1", "A2"],
        title: { en: "A1 and A2 in two months", th: "จบ A1 และ A2 ใน 60 วัน" },
        summary: {
            en: "Two levels in sixty days — the point at which ordinary written English starts to be readable.",
            th: "สองระดับใน 60 วัน คือจุดที่ภาษาอังกฤษที่เขียนกันทั่วไปเริ่มอ่านออก",
        },
        intro: {
            en: "A1 alone gets you through a menu; A1 plus A2 is roughly where a simple news article stops being a wall. This plan runs the two levels back to back at the same daily pace, which matters more than the total: the second level is where most people quit, and they quit because they changed the pace, not because the words got harder.",
            th: "ระดับ A1 อย่างเดียวพอให้อ่านเมนูรู้เรื่อง ส่วน A1 บวก A2 คือจุดที่ข่าวสั้น ๆ เลิกเป็นกำแพง แผนนี้เรียนสองระดับต่อกันด้วยจังหวะรายวันเท่าเดิม ซึ่งสำคัญกว่ายอดรวม เพราะระดับที่สองคือจุดที่คนส่วนใหญ่เลิก และเลิกเพราะเปลี่ยนจังหวะ ไม่ใช่เพราะคำยากขึ้น",
        },
        recovery: {
            en: "Two months is long enough that something will go wrong. Keep one day a week empty from the start and use it as the buffer — a plan with slack built in survives a bad week; a perfect plan does not.",
            th: "สองเดือนนานพอที่จะมีอะไรผิดแผน ให้เว้นหนึ่งวันต่อสัปดาห์ไว้ว่างตั้งแต่แรกและใช้เป็นวันสำรอง แผนที่เผื่อที่ว่างไว้จะรอดจากสัปดาห์ที่แย่ ส่วนแผนที่สมบูรณ์แบบจะไม่รอด",
        },
    },
    {
        slug: "90-days",
        days: 90,
        levels: ["A1", "A2", "B1"],
        title: { en: "Three levels in three months", th: "จบสามระดับใน 90 วัน" },
        summary: {
            en: "A1 through B1 in ninety days — the range that covers most everyday reading and listening.",
            th: "เรียนตั้งแต่ A1 ถึง B1 ใน 90 วัน คือช่วงที่ครอบคลุมการอ่านและการฟังในชีวิตประจำวันส่วนใหญ่",
        },
        intro: {
            en: "B1 is the level where vocabulary stops being the thing that limits you and grammar takes over, which makes it a genuine finish line rather than an arbitrary one. Ninety days is demanding — expect forty minutes a day — and it only works if the first thirty are already a habit. Do the thirty-day plan first if you are starting from zero.",
            th: "ระดับ B1 คือจุดที่คำศัพท์เลิกเป็นข้อจำกัดและไวยากรณ์เข้ามาแทน จึงเป็นเส้นชัยที่มีความหมายจริง ไม่ใช่ตัวเลขที่ตั้งขึ้นมาลอย ๆ เก้าสิบวันเป็นแผนที่หนัก ให้เผื่อเวลาวันละสี่สิบนาที และจะได้ผลก็ต่อเมื่อสามสิบวันแรกกลายเป็นนิสัยแล้ว ถ้าเริ่มจากศูนย์ ให้ทำแผนสามสิบวันก่อน",
        },
        recovery: {
            en: "At this length the risk is not missing a day, it is losing the earlier levels while you work on the later ones. Spend the first five minutes of each session on review before any new unit — that is what the plan is really for.",
            th: "ที่ความยาวขนาดนี้ ความเสี่ยงไม่ใช่การขาดหนึ่งวัน แต่คือการลืมระดับก่อนหน้าขณะที่กำลังเรียนระดับถัดไป ให้ใช้ห้านาทีแรกของทุกครั้งไปกับการทบทวนก่อนเริ่มบทใหม่ นั่นคือสิ่งที่แผนนี้มีไว้เพื่อการนั้นจริง ๆ",
        },
    },
];

export const planBySlug = (slug: string): StudyPlan | undefined =>
    STUDY_PLANS.find((plan) => plan.slug === slug);

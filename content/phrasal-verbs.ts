import type { PhrasalVerbSlug } from "@/lib/routes";
import type { LocalisedText } from "@/content/pronunciation";

/**
 * Phrasal verbs (SEO-CONTENT §Z).
 *
 * The reason this is a family and not a word page: the meaning is not the sum of the
 * parts. A learner who knows `look` and knows `after` still cannot read `look after`, and
 * no amount of enrichment on the `look` page fixes that — the entry is a different lexical
 * item that happens to be spelled with two words.
 *
 * `base` is the corpus slug of the verb, when it is published here, so every entry links
 * back into the word graph. Five of these verbs are not in the Oxford 3000 (`put`, `find`,
 * `set`, `fill`, `carry`); those entries simply carry no base link rather than a fabricated
 * one.
 *
 * Drafted content — a native review pass is still owed on the Thai.
 */

export type PhrasalVerb = {
    slug: PhrasalVerbSlug;
    /** The verb as it is written and searched: `look after`. */
    verb: string;
    /** The corpus slug of the base verb, when published. */
    base?: string;
    /** The short gloss. `th` is the Thai meaning a learner is looking for. */
    meaning: LocalisedText;
    /** Why the parts do not add up, and how it behaves. Two or three sentences. */
    note: LocalisedText;
    /** Three sentences. `en` is the English, `th` its Thai translation. */
    examples: LocalisedText[];
    /** Two or three entries a reader of this one wants next. */
    related: PhrasalVerbSlug[];
};

export const PHRASAL_VERBS: PhrasalVerb[] = [
    {
        slug: "break-down",
        verb: "break down",
        base: "break",
        meaning: { en: "to stop working; to lose control of your feelings", th: "เสีย ใช้การไม่ได้ หรือ ควบคุมอารมณ์ไม่อยู่" },
        note: {
            en: "Used for machines and for people, and the two senses share one form. A car breaks down; so does a person who has been holding something in for too long.",
            th: "ใช้ได้ทั้งกับเครื่องจักรและกับคน โดยใช้รูปเดียวกันทั้งสองความหมาย รถเสียก็ใช้คำนี้ และคนที่กลั้นความรู้สึกไว้นานเกินไปแล้วระเบิดออกมาก็ใช้คำนี้",
        },
        examples: [
            { en: "Our car broke down on the way home.", th: "รถของเราเสียระหว่างทางกลับบ้าน" },
            { en: "The printer breaks down every week.", th: "เครื่องพิมพ์เสียทุกสัปดาห์" },
            { en: "She broke down when she heard the news.", th: "เธอร้องไห้ออกมาเมื่อได้ยินข่าว" },
        ],
        related: ["figure-out", "run-out-of", "check-out"],
    },
    {
        slug: "call-back",
        verb: "call back",
        base: "call",
        meaning: { en: "to telephone someone again, or to return their call", th: "โทรกลับ" },
        note: {
            en: "The object can sit in the middle or at the end — call me back and call back the office are both correct. With a pronoun it must go in the middle: never call back me.",
            th: "กรรมวางไว้ตรงกลางหรือท้ายก็ได้ เช่น call me back และ call back the office ถูกทั้งคู่ แต่ถ้าเป็นสรรพนามต้องวางไว้ตรงกลางเท่านั้น พูดว่า call back me ไม่ได้",
        },
        examples: [
            { en: "I will call you back in ten minutes.", th: "อีกสิบนาทีฉันจะโทรกลับหา" },
            { en: "Could you call back later?", th: "โทรกลับมาทีหลังได้ไหม" },
            { en: "He never called me back.", th: "เขาไม่เคยโทรกลับหาฉันเลย" },
        ],
        related: ["check-in", "get-on", "keep-on"],
    },
    {
        slug: "carry-on",
        verb: "carry on",
        meaning: { en: "to continue doing something", th: "ทำต่อไป ดำเนินต่อ" },
        note: {
            en: "Close to continue but more spoken, and it often carries the sense of continuing in spite of something. It is followed by -ing, not by to: carry on working.",
            th: "ความหมายใกล้เคียงกับ continue แต่เป็นภาษาพูดมากกว่า และมักมีนัยว่าทำต่อทั้ง ๆ ที่มีอุปสรรค ตามด้วยรูป -ing ไม่ใช่ to เช่น carry on working",
        },
        examples: [
            { en: "Carry on — I am listening.", th: "พูดต่อเลย ฉันฟังอยู่" },
            { en: "They carried on working until midnight.", th: "พวกเขาทำงานต่อจนถึงเที่ยงคืน" },
            { en: "We must carry on without him.", th: "เราต้องทำต่อไปโดยไม่มีเขา" },
        ],
        related: ["keep-on", "go-on", "give-up"],
    },
    {
        slug: "check-in",
        verb: "check in",
        base: "check",
        meaning: { en: "to register at a hotel, airport or event", th: "เช็คอิน ลงทะเบียนเข้าพักหรือขึ้นเครื่อง" },
        note: {
            en: "The one phrasal verb most Thai learners already half know, because the noun check-in is borrowed into Thai. The verb is two words; the noun and the adjective are hyphenated.",
            th: "เป็นวลีกริยาที่ผู้เรียนไทยส่วนใหญ่รู้จักอยู่แล้วครึ่งหนึ่ง เพราะคำนาม check-in ถูกยืมเข้ามาในภาษาไทย รูปกริยาเขียนแยกสองคำ ส่วนคำนามและคำคุณศัพท์เขียนติดกันด้วยยัติภังค์",
        },
        examples: [
            { en: "We check in at two o'clock.", th: "เราเช็คอินตอนบ่ายสองโมง" },
            { en: "You can check in online.", th: "คุณเช็คอินออนไลน์ได้" },
            { en: "Please check in an hour before the flight.", th: "กรุณาเช็คอินก่อนเครื่องออกหนึ่งชั่วโมง" },
        ],
        related: ["check-out", "get-on", "take-off"],
    },
    {
        slug: "check-out",
        verb: "check out",
        base: "check",
        meaning: { en: "to leave a hotel; to look at something", th: "เช็คเอาต์ หรือ ลองดู ลองเช็ค" },
        note: {
            en: "Two senses that share nothing: leaving a hotel, and taking a look at something. The second is very informal and extremely common in speech — check out this photo.",
            th: "มีสองความหมายที่ไม่เกี่ยวกันเลย คือออกจากโรงแรม กับลองดูอะไรสักอย่าง ความหมายที่สองเป็นภาษาพูดมาก และใช้บ่อยมากในการสนทนา เช่น check out this photo",
        },
        examples: [
            { en: "We check out before eleven.", th: "เราเช็คเอาต์ก่อนสิบเอ็ดโมง" },
            { en: "Check out the new shop on the corner.", th: "ลองไปดูร้านใหม่ตรงหัวมุมสิ" },
            { en: "I checked out three hotels online.", th: "ฉันลองดูโรงแรมสามแห่งทางออนไลน์" },
        ],
        related: ["check-in", "look-for", "find-out"],
    },
    {
        slug: "come-back",
        verb: "come back",
        base: "come",
        meaning: { en: "to return to a place", th: "กลับมา" },
        note: {
            en: "Come back means returning to where the speaker is; go back means returning to somewhere else. Thai uses กลับ for both, which is why the pair gets swapped so often.",
            th: "come back คือกลับมายังที่ที่ผู้พูดอยู่ ส่วน go back คือกลับไปยังที่อื่น ภาษาไทยใช้คำว่า กลับ กับทั้งสองกรณี คู่นี้จึงถูกสลับกันบ่อยมาก",
        },
        examples: [
            { en: "Come back before dark.", th: "กลับมาก่อนมืดนะ" },
            { en: "She came back from Japan last week.", th: "เธอกลับมาจากญี่ปุ่นเมื่อสัปดาห์ที่แล้ว" },
            { en: "I will come back tomorrow.", th: "พรุ่งนี้ฉันจะกลับมา" },
        ],
        related: ["go-out", "get-off", "wake-up"],
    },
    {
        slug: "deal-with",
        verb: "deal with",
        base: "deal",
        meaning: { en: "to handle a problem, task or person", th: "จัดการ รับมือกับ" },
        note: {
            en: "Always takes an object and the object never moves: deal with it, never deal it with. It covers problems, people and paperwork alike.",
            th: "ต้องมีกรรมเสมอ และกรรมย้ายที่ไม่ได้ ต้องพูดว่า deal with it ไม่ใช่ deal it with ใช้ได้ทั้งกับปัญหา กับคน และกับงานเอกสาร",
        },
        examples: [
            { en: "I will deal with it this afternoon.", th: "ฉันจะจัดการเรื่องนี้ตอนบ่าย" },
            { en: "She deals with customers all day.", th: "เธอรับมือกับลูกค้าทั้งวัน" },
            { en: "We had to deal with a serious problem.", th: "เราต้องจัดการกับปัญหาร้ายแรง" },
        ],
        related: ["figure-out", "look-after", "break-down"],
    },
    {
        slug: "figure-out",
        verb: "figure out",
        base: "figure",
        meaning: { en: "to work something out; to understand it after thinking", th: "คิดออก เข้าใจได้หลังจากคิด" },
        note: {
            en: "The result of thinking, not the thinking itself — you figure something out at the moment it becomes clear. The object can sit in the middle: figure it out.",
            th: "หมายถึงผลของการคิด ไม่ใช่ตัวการคิดเอง คือคิดออกในจังหวะที่เรื่องนั้นกระจ่างขึ้นมา กรรมวางไว้ตรงกลางได้ เช่น figure it out",
        },
        examples: [
            { en: "I cannot figure out this question.", th: "ฉันคิดคำถามข้อนี้ไม่ออก" },
            { en: "We figured out the answer together.", th: "เราช่วยกันคิดจนได้คำตอบ" },
            { en: "Give me a minute to figure it out.", th: "ขอเวลาสักนาทีให้คิดออกก่อน" },
        ],
        related: ["find-out", "deal-with", "look-for"],
    },
    {
        slug: "fill-in",
        verb: "fill in",
        meaning: { en: "to complete a form; to substitute for someone", th: "กรอกแบบฟอร์ม หรือ ทำแทนคนอื่นชั่วคราว" },
        note: {
            en: "With a form the object can go in the middle — fill it in. With a person it takes for: fill in for a colleague.",
            th: "ถ้าใช้กับแบบฟอร์ม กรรมวางตรงกลางได้ เช่น fill it in ถ้าใช้กับคน ต้องตามด้วย for เช่น fill in for a colleague",
        },
        examples: [
            { en: "Please fill in this form.", th: "กรุณากรอกแบบฟอร์มนี้" },
            { en: "Fill it in and give it back to me.", th: "กรอกให้เสร็จแล้วส่งคืนฉันด้วย" },
            { en: "He filled in for her last week.", th: "สัปดาห์ที่แล้วเขาทำงานแทนเธอ" },
        ],
        related: ["find-out", "check-in", "set-up"],
    },
    {
        slug: "find-out",
        verb: "find out",
        meaning: { en: "to learn a fact, often by asking or searching", th: "หาข้อมูลจนรู้ ค้นพบความจริง" },
        note: {
            en: "About information, not about objects: you find your keys, but you find out the time of the train. That split is the most common mistake with this one.",
            th: "ใช้กับข้อมูล ไม่ใช้กับสิ่งของ กุญแจใช้ find ส่วนเวลารถไฟใช้ find out ความแตกต่างตรงนี้คือจุดที่ผิดกันบ่อยที่สุด",
        },
        examples: [
            { en: "I want to find out what happened.", th: "ฉันอยากรู้ว่าเกิดอะไรขึ้น" },
            { en: "Find out when the shop opens.", th: "ช่วยไปหาข้อมูลว่าร้านเปิดกี่โมง" },
            { en: "We found out later that he was right.", th: "ทีหลังเราถึงรู้ว่าเขาพูดถูก" },
        ],
        related: ["figure-out", "look-for", "check-out"],
    },
    {
        slug: "get-off",
        verb: "get off",
        base: "get",
        meaning: { en: "to leave a bus, train or plane", th: "ลงจากรถ ลงจากเครื่อง" },
        note: {
            en: "Used for vehicles you stand up in — buses, trains, planes, bicycles. For a car or a taxi English uses get out of instead, which is the pair most learners mix up.",
            th: "ใช้กับยานพาหนะที่ยืนขึ้นได้ เช่น รถบัส รถไฟ เครื่องบิน จักรยาน ส่วนรถยนต์หรือแท็กซี่ ภาษาอังกฤษใช้ get out of แทน ซึ่งเป็นคู่ที่ผู้เรียนสับสนกันมากที่สุด",
        },
        examples: [
            { en: "Get off at the next stop.", th: "ลงป้ายหน้านะ" },
            { en: "We got off the train in Chiang Mai.", th: "เราลงรถไฟที่เชียงใหม่" },
            { en: "She got off the bus and walked home.", th: "เธอลงจากรถบัสแล้วเดินกลับบ้าน" },
        ],
        related: ["get-on", "get-up", "take-off"],
    },
    {
        slug: "get-on",
        verb: "get on",
        base: "get",
        meaning: { en: "to board a bus, train or plane; to have a good relationship", th: "ขึ้นรถ ขึ้นเครื่อง หรือ เข้ากันได้ดี" },
        note: {
            en: "The transport sense is the mirror of get off. The second sense takes with — get on with someone — and is used constantly in everyday British and Australian speech.",
            th: "ความหมายเรื่องการเดินทางเป็นคู่ตรงข้ามของ get off ส่วนความหมายที่สองต้องตามด้วย with เช่น get on with someone และใช้บ่อยมากในภาษาพูดของอังกฤษและออสเตรเลีย",
        },
        examples: [
            { en: "Get on the bus at the front.", th: "ขึ้นรถบัสทางด้านหน้า" },
            { en: "They get on well with their neighbours.", th: "พวกเขาเข้ากับเพื่อนบ้านได้ดี" },
            { en: "We got on the plane at six.", th: "เราขึ้นเครื่องตอนหกโมง" },
        ],
        related: ["get-off", "check-in", "come-back"],
    },
    {
        slug: "get-up",
        verb: "get up",
        base: "get",
        meaning: { en: "to leave your bed; to stand up", th: "ตื่นนอนแล้วลุกขึ้น หรือ ยืนขึ้น" },
        note: {
            en: "Not the same as wake up: you wake up when your eyes open, and you get up when your feet reach the floor. Thai often uses ตื่น for both, so the pair is worth learning together.",
            th: "ไม่เหมือนกับ wake up เพราะ wake up คือตอนลืมตา ส่วน get up คือตอนที่เท้าแตะพื้น ภาษาไทยมักใช้คำว่า ตื่น กับทั้งสองกรณี จึงควรเรียนคู่นี้ไปพร้อมกัน",
        },
        examples: [
            { en: "I get up at six every day.", th: "ฉันลุกจากเตียงตอนหกโมงทุกวัน" },
            { en: "He got up and opened the window.", th: "เขาลุกขึ้นแล้วเปิดหน้าต่าง" },
            { en: "What time do you get up?", th: "คุณตื่นนอนลุกขึ้นกี่โมง" },
        ],
        related: ["wake-up", "get-off", "go-out"],
    },
    {
        slug: "give-up",
        verb: "give up",
        base: "give",
        meaning: { en: "to stop trying; to stop a habit", th: "ยอมแพ้ เลิกทำ หรือ เลิกนิสัยบางอย่าง" },
        note: {
            en: "Followed by -ing when it names the habit: give up smoking. Used alone it means to stop trying, which is why it turns up in every exam-day pep talk.",
            th: "ถ้าใช้กับนิสัย ต้องตามด้วยรูป -ing เช่น give up smoking ถ้าใช้เดี่ยว ๆ จะแปลว่ายอมแพ้ จึงเป็นคำที่โผล่มาในคำให้กำลังใจก่อนสอบเสมอ",
        },
        examples: [
            { en: "Do not give up now.", th: "อย่าเพิ่งยอมแพ้ตอนนี้" },
            { en: "He gave up coffee last year.", th: "เขาเลิกกาแฟเมื่อปีที่แล้ว" },
            { en: "She never gives up.", th: "เธอไม่เคยยอมแพ้" },
        ],
        related: ["keep-on", "carry-on", "run-out-of"],
    },
    {
        slug: "go-on",
        verb: "go on",
        base: "go",
        meaning: { en: "to continue; to happen", th: "ดำเนินต่อ หรือ เกิดขึ้น" },
        note: {
            en: "What is going on? is the most common question in English that uses it, and it means what is happening. As continue it takes -ing, like carry on.",
            th: "ประโยค What is going on? เป็นคำถามที่ใช้คำนี้บ่อยที่สุดในภาษาอังกฤษ และแปลว่าเกิดอะไรขึ้น ถ้าใช้ในความหมายว่าทำต่อ ต้องตามด้วยรูป -ing เหมือน carry on",
        },
        examples: [
            { en: "What is going on here?", th: "เกิดอะไรขึ้นที่นี่" },
            { en: "The meeting went on for two hours.", th: "การประชุมดำเนินไปสองชั่วโมง" },
            { en: "Go on, tell me the rest.", th: "เล่าต่อสิ ที่เหลือเป็นยังไง" },
        ],
        related: ["carry-on", "keep-on", "go-out"],
    },
    {
        slug: "go-out",
        verb: "go out",
        base: "go",
        meaning: { en: "to leave home for something social; to stop burning", th: "ออกไปข้างนอก ไปเที่ยว หรือ ดับ" },
        note: {
            en: "The social sense is the common one — go out for dinner, go out with friends. The second sense is used for lights and fires: the candle went out.",
            th: "ความหมายเรื่องออกไปสังสรรค์เป็นความหมายที่ใช้บ่อย เช่น go out for dinner และ go out with friends ส่วนอีกความหมายใช้กับไฟและแสงสว่าง เช่น the candle went out",
        },
        examples: [
            { en: "We go out every Friday.", th: "เราออกไปเที่ยวกันทุกวันศุกร์" },
            { en: "They went out for dinner.", th: "พวกเขาออกไปกินข้าวเย็นข้างนอก" },
            { en: "The lights went out at midnight.", th: "ไฟดับตอนเที่ยงคืน" },
        ],
        related: ["come-back", "hang-out", "go-on" ],
    },
    {
        slug: "grow-up",
        verb: "grow up",
        base: "grow",
        meaning: { en: "to become an adult; to spend your childhood somewhere", th: "เติบโตเป็นผู้ใหญ่ หรือ โตมาที่ไหน" },
        note: {
            en: "Almost always in the past when talking about place — I grew up in Khon Kaen. It is about the whole of childhood, not about getting taller, which is plain grow.",
            th: "เวลาพูดถึงสถานที่มักใช้รูปอดีตเสมอ เช่น I grew up in Khon Kaen หมายถึงช่วงวัยเด็กทั้งหมด ไม่ได้หมายถึงการสูงขึ้น ซึ่งใช้คำว่า grow เฉย ๆ",
        },
        examples: [
            { en: "I grew up in a small town.", th: "ฉันโตมาในเมืองเล็ก ๆ" },
            { en: "Where did you grow up?", th: "คุณโตที่ไหน" },
            { en: "The children are growing up fast.", th: "เด็ก ๆ โตเร็วมาก" },
        ],
        related: ["wake-up", "come-back", "look-after"],
    },
    {
        slug: "hang-out",
        verb: "hang out",
        base: "hang",
        meaning: { en: "to spend time somewhere with no particular plan", th: "ไปนั่งเล่น ใช้เวลาอยู่ด้วยกันแบบไม่มีแผน" },
        note: {
            en: "Informal and very common among younger speakers. It takes with for people and at or in for places: hang out with friends at a cafe.",
            th: "เป็นภาษาพูดและใช้กันมากในกลุ่มคนรุ่นใหม่ ถ้าใช้กับคนให้ตามด้วย with ถ้าใช้กับสถานที่ให้ตามด้วย at หรือ in เช่น hang out with friends at a cafe",
        },
        examples: [
            { en: "We hang out at the mall on Sundays.", th: "วันอาทิตย์เราไปนั่งเล่นกันที่ห้าง" },
            { en: "He hangs out with his cousins.", th: "เขาใช้เวลาอยู่กับลูกพี่ลูกน้อง" },
            { en: "Do you want to hang out later?", th: "เดี๋ยวไปนั่งเล่นด้วยกันไหม" },
        ],
        related: ["go-out", "come-back", "pick-up"],
    },
    {
        slug: "keep-on",
        verb: "keep on",
        base: "keep",
        meaning: { en: "to continue doing something, often annoyingly", th: "ทำต่อไปเรื่อย ๆ มักมีนัยว่าน่ารำคาญ" },
        note: {
            en: "Almost always followed by -ing, and it usually carries a hint of complaint: he keeps on asking. Without that hint, carry on or go on is the better choice.",
            th: "เกือบจะตามด้วยรูป -ing เสมอ และมักมีนัยของการบ่น เช่น he keeps on asking ถ้าไม่ต้องการนัยแบบนั้น ใช้ carry on หรือ go on จะเหมาะกว่า",
        },
        examples: [
            { en: "He keeps on asking the same question.", th: "เขาถามคำถามเดิมซ้ำ ๆ ไม่หยุด" },
            { en: "Keep on trying.", th: "พยายามต่อไปนะ" },
            { en: "The phone kept on ringing.", th: "โทรศัพท์ดังไม่หยุดเลย" },
        ],
        related: ["carry-on", "go-on", "give-up"],
    },
    {
        slug: "look-after",
        verb: "look after",
        base: "look",
        meaning: { en: "to take care of someone or something", th: "ดูแล" },
        note: {
            en: "Nothing to do with looking. It is one of the clearest cases of a phrasal verb whose meaning cannot be guessed from its parts, and it always takes an object.",
            th: "ไม่เกี่ยวกับการมองเลย เป็นตัวอย่างที่ชัดเจนที่สุดของวลีกริยาที่เดาความหมายจากคำที่ประกอบกันไม่ได้ และต้องมีกรรมเสมอ",
        },
        examples: [
            { en: "Can you look after my bag?", th: "ช่วยดูกระเป๋าให้หน่อยได้ไหม" },
            { en: "She looks after her grandmother.", th: "เธอดูแลคุณยายของเธอ" },
            { en: "Who looks after the dog?", th: "ใครเป็นคนดูแลสุนัข" },
        ],
        related: ["look-for", "look-forward-to", "deal-with"],
    },
    {
        slug: "look-for",
        verb: "look for",
        base: "look",
        meaning: { en: "to try to find something", th: "มองหา ตามหา" },
        note: {
            en: "The trying, not the finding — look for is the search and find is the result. Saying I looked for my keys and I found them describes two different moments.",
            th: "หมายถึงการพยายามหา ไม่ใช่การเจอ คำว่า look for คือการค้นหา ส่วน find คือผลลัพธ์ ประโยค I looked for my keys and I found them จึงพูดถึงสองจังหวะที่ต่างกัน",
        },
        examples: [
            { en: "I am looking for my phone.", th: "ฉันกำลังหาโทรศัพท์อยู่" },
            { en: "She is looking for a new job.", th: "เธอกำลังหางานใหม่" },
            { en: "What are you looking for?", th: "คุณกำลังหาอะไรอยู่" },
        ],
        related: ["look-after", "find-out", "figure-out"],
    },
    {
        slug: "look-forward-to",
        verb: "look forward to",
        base: "look",
        meaning: { en: "to feel happy about something that will happen", th: "ตั้งตารอ รอคอยด้วยความยินดี" },
        note: {
            en: "The to here is a preposition, not part of an infinitive, so what follows is a noun or an -ing form: look forward to seeing you, never look forward to see you. It is the most common mistake in polite English email.",
            th: "คำว่า to ในวลีนี้เป็นคำบุพบท ไม่ใช่ส่วนหนึ่งของรูป infinitive สิ่งที่ตามมาจึงต้องเป็นคำนามหรือรูป -ing เช่น look forward to seeing you ไม่ใช่ look forward to see you นี่คือจุดที่ผิดกันบ่อยที่สุดในอีเมลภาษาอังกฤษแบบสุภาพ",
        },
        examples: [
            { en: "I look forward to meeting you.", th: "ฉันตั้งตารอที่จะได้พบคุณ" },
            { en: "We are looking forward to the trip.", th: "เรากำลังตั้งตารอทริปนี้อยู่" },
            { en: "She looks forward to Friday every week.", th: "เธอรอวันศุกร์ทุกสัปดาห์" },
        ],
        related: ["look-after", "look-for", "carry-on"],
    },
    {
        slug: "pick-up",
        verb: "pick up",
        base: "pick",
        meaning: { en: "to lift something; to collect someone; to learn casually", th: "หยิบขึ้นมา ไปรับ หรือ เรียนรู้แบบไม่ตั้งใจ" },
        note: {
            en: "Three senses in daily use, and the third is the interesting one: you pick up a language by living with it rather than by studying it. The object can sit in the middle — pick it up.",
            th: "มีสามความหมายที่ใช้ในชีวิตประจำวัน และความหมายที่สามน่าสนใจที่สุด คือการเรียนภาษาจากการใช้ชีวิตกับมัน ไม่ใช่จากการนั่งเรียน กรรมวางไว้ตรงกลางได้ เช่น pick it up",
        },
        examples: [
            { en: "Pick up the box carefully.", th: "ยกกล่องขึ้นมาอย่างระวัง" },
            { en: "I will pick you up at seven.", th: "ฉันจะไปรับคุณตอนหนึ่งทุ่ม" },
            { en: "He picked up Thai in two years.", th: "เขาเรียนรู้ภาษาไทยได้ภายในสองปี" },
        ],
        related: ["take-off", "hang-out", "set-up"],
    },
    {
        slug: "put-on",
        verb: "put on",
        meaning: { en: "to dress in something; to switch something on", th: "สวมใส่ หรือ เปิดเครื่อง" },
        note: {
            en: "Put on is the action of dressing; wear is the state of being dressed. Thai uses ใส่ for both, so this is one of the highest-value distinctions on this page.",
            th: "put on คือการกระทำตอนสวมใส่ ส่วน wear คือสภาพที่ใส่อยู่แล้ว ภาษาไทยใช้คำว่า ใส่ กับทั้งสองอย่าง ความต่างตรงนี้จึงคุ้มค่าที่สุดในหน้านี้",
        },
        examples: [
            { en: "Put on your shoes.", th: "ใส่รองเท้าซะ" },
            { en: "She put on a jacket and left.", th: "เธอใส่แจ็กเก็ตแล้วออกไป" },
            { en: "Put the light on, please.", th: "ช่วยเปิดไฟหน่อย" },
        ],
        related: ["take-off", "turn-on", "turn-off"],
    },
    {
        slug: "run-out-of",
        verb: "run out of",
        base: "run",
        meaning: { en: "to have none of something left", th: "หมด ใช้จนหมด" },
        note: {
            en: "Three words that behave as one, and the of is not optional when there is an object: we ran out of rice. Without an object, run out alone is correct: the milk ran out.",
            th: "สามคำที่ทำงานเหมือนคำเดียว และคำว่า of ตัดไม่ได้เมื่อมีกรรม เช่น we ran out of rice แต่ถ้าไม่มีกรรม ใช้ run out เฉย ๆ ได้ เช่น the milk ran out",
        },
        examples: [
            { en: "We ran out of water.", th: "น้ำของเราหมด" },
            { en: "They are running out of time.", th: "พวกเขาใกล้จะหมดเวลาแล้ว" },
            { en: "The shop ran out of bread.", th: "ขนมปังที่ร้านหมด" },
        ],
        related: ["break-down", "give-up", "deal-with"],
    },
    {
        slug: "set-up",
        verb: "set up",
        meaning: { en: "to start something; to arrange equipment", th: "ก่อตั้ง เริ่มต้น หรือ ติดตั้ง" },
        note: {
            en: "Used for organisations and for equipment alike — set up a company, set up a printer. The noun setup is one word, which is worth knowing because the two are constantly confused in writing.",
            th: "ใช้ได้ทั้งกับองค์กรและกับอุปกรณ์ เช่น set up a company และ set up a printer ส่วนคำนาม setup เขียนติดกันเป็นคำเดียว ควรจำไว้เพราะสองรูปนี้สับสนกันบ่อยในการเขียน",
        },
        examples: [
            { en: "They set up the company in 2019.", th: "พวกเขาก่อตั้งบริษัทในปี 2019" },
            { en: "Can you set up the projector?", th: "ช่วยติดตั้งโปรเจกเตอร์ได้ไหม" },
            { en: "We set it up this morning.", th: "เราติดตั้งมันไว้เมื่อเช้านี้" },
        ],
        related: ["fill-in", "pick-up", "turn-on"],
    },
    {
        slug: "take-off",
        verb: "take off",
        base: "take",
        meaning: { en: "to remove clothing; to leave the ground", th: "ถอดออก หรือ เครื่องบินขึ้น" },
        note: {
            en: "The opposite of put on for clothes, and the word for a plane leaving the ground. The two senses share one form and never confuse anybody, because the context is always obvious.",
            th: "เป็นคำตรงข้ามของ put on เมื่อใช้กับเสื้อผ้า และเป็นคำที่ใช้เมื่อเครื่องบินทะยานขึ้น สองความหมายใช้รูปเดียวกันแต่ไม่เคยทำให้ใครสับสน เพราะบริบทชัดเจนเสมอ",
        },
        examples: [
            { en: "Take off your shoes at the door.", th: "ถอดรองเท้าตรงประตูด้วย" },
            { en: "The plane takes off at nine.", th: "เครื่องบินขึ้นตอนสามทุ่ม" },
            { en: "He took off his hat.", th: "เขาถอดหมวกออก" },
        ],
        related: ["put-on", "get-off", "check-in"],
    },
    {
        slug: "turn-off",
        verb: "turn off",
        base: "turn",
        meaning: { en: "to stop a machine, light or tap working", th: "ปิด เช่น ปิดไฟ ปิดเครื่อง" },
        note: {
            en: "English needs a different verb for closing a door and switching off a light; Thai uses ปิด for both. Turn off is the switch one, and close is never used for a light.",
            th: "ภาษาอังกฤษใช้คำกริยาคนละคำระหว่างปิดประตูกับปิดไฟ แต่ภาษาไทยใช้คำว่า ปิด ทั้งคู่ turn off ใช้กับสวิตช์ และไม่ใช้คำว่า close กับไฟเด็ดขาด",
        },
        examples: [
            { en: "Turn off the light before you leave.", th: "ปิดไฟก่อนออกไปด้วย" },
            { en: "Please turn your phone off.", th: "กรุณาปิดโทรศัพท์" },
            { en: "I turned it off an hour ago.", th: "ฉันปิดมันไปเมื่อชั่วโมงที่แล้ว" },
        ],
        related: ["turn-on", "put-on", "set-up"],
    },
    {
        slug: "turn-on",
        verb: "turn on",
        base: "turn",
        meaning: { en: "to make a machine, light or tap work", th: "เปิด เช่น เปิดไฟ เปิดเครื่อง" },
        note: {
            en: "The mirror of turn off, and the same warning applies: open is for doors and boxes, never for a light or a tap. The object can sit in the middle — turn it on.",
            th: "เป็นคู่ตรงข้ามของ turn off และมีข้อควรระวังเดียวกัน คือคำว่า open ใช้กับประตูและกล่อง ไม่ใช้กับไฟหรือก๊อกน้ำ กรรมวางไว้ตรงกลางได้ เช่น turn it on",
        },
        examples: [
            { en: "Turn on the fan, please.", th: "ช่วยเปิดพัดลมหน่อย" },
            { en: "She turned on the radio.", th: "เธอเปิดวิทยุ" },
            { en: "Turn it on and wait a minute.", th: "เปิดมันแล้วรอสักครู่" },
        ],
        related: ["turn-off", "put-on", "set-up"],
    },
    {
        slug: "wake-up",
        verb: "wake up",
        base: "wake",
        meaning: { en: "to stop sleeping", th: "ตื่นนอน" },
        note: {
            en: "The moment your eyes open — getting out of bed is get up. Wake up can also be done to someone else: wake me up at six.",
            th: "หมายถึงจังหวะที่ลืมตา ส่วนการลุกจากเตียงคือ get up นอกจากนี้ wake up ยังใช้กับการปลุกคนอื่นได้ด้วย เช่น wake me up at six",
        },
        examples: [
            { en: "I wake up before the alarm.", th: "ฉันตื่นก่อนนาฬิกาปลุกดัง" },
            { en: "Wake me up at six, please.", th: "ช่วยปลุกฉันตอนหกโมงด้วย" },
            { en: "He woke up late and missed the bus.", th: "เขาตื่นสายเลยตกรถบัส" },
        ],
        related: ["get-up", "grow-up", "come-back"],
    },
];

export const phrasalBySlug = (slug: string): PhrasalVerb | undefined =>
    PHRASAL_VERBS.find((entry) => entry.slug === slug);

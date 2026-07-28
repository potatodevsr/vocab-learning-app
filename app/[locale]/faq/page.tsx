import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { jsonLd, publicMetadata } from "@/lib/seo";

type FaqPageProps = { params: Promise<{ locale: string }> };

/**
 * Question-shaped searches ("ควรท่องศัพท์วันละกี่คำ", "Oxford 3000 คืออะไร") are a
 * different surface from word pages, and `FAQPage` structured data is eligible for
 * expanded results (docs/SPEC.md §9.4).
 *
 * Every answer here is true of the product as built. Padding this page with invented
 * questions would be the thin-content trap §9.7 rules out.
 */
const FAQ = [
  {
    q: "Oxford 3000 คืออะไร",
    a: "Oxford 3000 คือรายการคำศัพท์ภาษาอังกฤษ 3,000 คำที่พบบ่อยและสำคัญที่สุด คัดเลือกโดยทีมพจนานุกรมของ Oxford จัดกลุ่มตามระดับ CEFR ตั้งแต่ A1 ถึง B2 ถ้ารู้คำเหล่านี้ จะเข้าใจภาษาอังกฤษที่ใช้จริงได้เป็นส่วนใหญ่",
  },
  {
    q: "ควรท่องศัพท์ภาษาอังกฤษวันละกี่คำ",
    a: "บทเรียนในเว็บนี้ตั้งไว้ที่ 8 คำต่อรอบ ใช้เวลาประมาณ 2–3 นาที เพราะการเรียนสั้น ๆ ทุกวันได้ผลกว่าการเรียนยาว ๆ นาน ๆ ครั้ง คำที่ตอบผิดจะถูกนำกลับมาทบทวนให้เองโดยอัตโนมัติ",
  },
  {
    q: "คำศัพท์ระดับ A1 A2 B1 B2 ต่างกันอย่างไร",
    a: "A1 คือระดับเริ่มต้น เป็นคำพื้นฐานที่ใช้บ่อยที่สุด A2 เป็นระดับต้นที่ใช้ในชีวิตประจำวัน B1 เป็นระดับกลางสำหรับการเรียนและการทำงาน ส่วน B2 เป็นระดับสูงที่ใช้อ่านบทความและเตรียมสอบ ควรเรียนไล่จาก A1 ขึ้นไป",
  },
  {
    q: "เว็บนี้ใช้ฟรีไหม",
    a: "ใช้ได้ฟรี สมัครบัญชีเพื่อบันทึกความคืบหน้า คำที่รู้แล้ว และคำที่ต้องทบทวน โดยไม่มีค่าใช้จ่าย",
  },
  {
    q: "จำเป็นต้องสมัครสมาชิกไหม",
    a: "ดูคำศัพท์และความหมายได้โดยไม่ต้องสมัคร แต่ถ้าต้องการให้ระบบจำว่าเรียนถึงไหน คำไหนรู้แล้ว และคำไหนต้องทบทวน ต้องสมัครบัญชีก่อน",
  },
  {
    q: "ระบบทบทวนคำศัพท์ทำงานอย่างไร",
    a: "ทุกครั้งที่ตอบถูก ระบบจะเลื่อนกำหนดทบทวนคำนั้นออกไปไกลขึ้น และถ้าตอบผิดจะดึงกลับมาให้ทบทวนเร็วขึ้น คำที่ตอบผิดจะรวมอยู่ในหน้า “คำที่ตอบผิด” เพื่อฝึกซ้ำได้ทันที",
  },
];

export async function generateMetadata({
  params,
}: FaqPageProps): Promise<Metadata> {
  const { locale } = await params;

  return publicMetadata({
    locale,
    path: "faq",
    title: "คำถามที่พบบ่อย — เรียนคำศัพท์ภาษาอังกฤษ Oxford 3000",
    description:
      "Oxford 3000 คืออะไร ควรท่องศัพท์วันละกี่คำ ระดับ A1 A2 B1 B2 ต่างกันอย่างไร และระบบทบทวนคำศัพท์ทำงานอย่างไร",
  });
}

export default async function FaqPage() {
  return (
    <>
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        })}
      />

      <main className="min-h-screen bg-background text-foreground">
        <section className="bg-accent-sky text-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-12 lg:px-8">
          <h1>คำถามที่พบบ่อย</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/90">
            เรื่องที่คนถามบ่อยที่สุดเกี่ยวกับการท่องคำศัพท์ภาษาอังกฤษและชุดคำศัพท์ Oxford 3000
          </p>
        </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
        <dl className="grid gap-4" data-testid="faq-list">
          {FAQ.map((item) => (
            <div key={item.q} className="play-card p-6">
              <dt className="text-xl font-bold">{item.q}</dt>
              <dd className="mt-2 leading-7 text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>

        <Button
          asChild
          size="lg"
          className="play-press mt-8 h-12 rounded-full bg-brand px-6 text-white hover:bg-brand"
        >
          <Link href="/english/a1">
            เริ่มเรียนคำศัพท์ A1
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        </section>
      </main>
    </>
  );
}

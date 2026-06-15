import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { getWordsBySlug } from "@/lib/oxford-words";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type WordPageProps = {
  params: Promise<{ word: string; locale: string }>;
};

export default async function WordPage({ params }: WordPageProps) {
  const { word: slug } = await params;
  const entries = await getWordsBySlug(slug);

  if (entries.length === 0) {
    notFound();
  }

  const head = entries[0];

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="border-b bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
          <Button
            asChild
            variant="ghost"
            className="rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            <Link href="/english/a1">
              <ArrowLeft className="size-4" />
              Back to A1 path
            </Link>
          </Button>

          <h1 className="mt-8 text-6xl font-semibold tracking-tight">
            {head.displayWord}
          </h1>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">
              {head.level}
            </Badge>

            <Badge
              variant="outline"
              className="rounded-full border-white/15 bg-white/5 text-white"
            >
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </Badge>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl space-y-4 px-6 py-10 lg:px-8">
        {entries.map((entry) => (
          <Card key={entry.id} className="rounded-3xl bg-white">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-zinc-950 text-white hover:bg-zinc-950">
                  {entry.partOfSpeech}
                </Badge>

                {entry.homograph !== null && (
                  <Badge variant="outline" className="rounded-full bg-white">
                    Homograph {entry.homograph}
                  </Badge>
                )}

                {entry.sense && (
                  <Badge variant="outline" className="rounded-full bg-white">
                    {entry.sense}
                  </Badge>
                )}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border bg-zinc-50 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Thai meaning
                  </p>
                  <p className="font-thai mt-2 text-lg font-semibold" lang="th">
                    {entry.meaningTh || "—"}
                  </p>
                </div>

                <div className="rounded-2xl border bg-zinc-50 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Pronunciation
                  </p>
                  <p className="font-thai mt-2 text-lg font-semibold" lang="th">
                    {entry.pronunciationTh || "—"}
                  </p>

                  {entry.ipa && (
                    <p className="mt-2 text-sm text-zinc-500">/{entry.ipa}/</p>
                  )}
                </div>
              </div>

              {entry.exampleEn && (
                <div className="mt-4 rounded-2xl border bg-zinc-50 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Example
                  </p>
                  <p className="mt-2 text-base leading-7 text-zinc-700">
                    {entry.exampleEn}
                  </p>

                  {entry.exampleTh && (
                    <p
                      className="font-thai mt-2 text-base leading-7 text-zinc-600"
                      lang="th"
                    >
                      {entry.exampleTh}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}

import { ArrowLeft } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function LocaleNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-accent-sky px-6 text-white">
      <div className="w-full max-w-md text-center" data-testid="not-found">
        <p className="text-sm font-semibold text-white/80">404</p>
        <h1 className="mt-2 text-2xl font-semibold">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-sm leading-6 text-white/90">
          The word or lesson you were looking for isn&apos;t here.
        </p>

        <Button
          asChild
          className="play-press mt-6 h-11 rounded-full bg-white px-6 font-semibold text-brand hover:bg-white"
        >
          <Link href="/english/a1">
            <ArrowLeft className="size-4" />
            Back to the A1 path
          </Link>
        </Button>
      </div>
    </main>
  );
}

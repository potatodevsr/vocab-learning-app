import { useTranslations } from "next-intl";

import { ThaiSpeech } from "@/components/play/thai-speech";
import type { LearnerMode } from "@/lib/learner-mode";
import type { OxfordWord } from "@/lib/types";

type WordExampleProps = Pick<OxfordWord, "exampleEn" | "exampleTh" | "exampleThRoman"> & {
  mode: LearnerMode;
};

/** Keep a Thai sentence and its reading together before showing the translation. */
export function WordExample({ mode, exampleEn, exampleTh, exampleThRoman }: WordExampleProps) {
  const t = useTranslations("ExampleSentence");
  const learningThai = mode === "thai";

  const thai = exampleTh.trim() && (
    <div key="thai" data-testid="example-thai">
      <p className="text-xs font-bold text-muted-foreground">{t("thai")}</p>
      <div className="mt-1 flex items-start gap-3">
        <p lang="th" className={`font-thai min-w-0 flex-1 break-words ${learningThai ? "text-2xl font-semibold leading-relaxed text-foreground" : "text-base leading-7 text-muted-foreground"}`}>
          {exampleTh}
        </p>
        {learningThai && <ThaiSpeech text={exampleTh} className="size-11" />}
      </div>
      {learningThai && (
        <div className="mt-3 rounded-xl bg-background p-3" data-testid="example-reading">
          <p className="text-xs font-bold text-muted-foreground">{t("roman")}</p>
          <p
            lang={exampleThRoman.trim() ? "th-Latn" : undefined}
            className="mt-1 break-words text-base leading-7 text-foreground"
            data-testid="example-roman"
          >
            {exampleThRoman.trim() || t("romanPending")}
          </p>
        </div>
      )}
    </div>
  );

  const english = exampleEn.trim() && (
    <div key="english" data-testid="example-english" className={learningThai && exampleTh.trim() ? "border-t border-ink/10 pt-3" : undefined}>
      <p className="text-xs font-bold text-muted-foreground">{t("english")}</p>
      <p lang="en" className={`mt-1 break-words leading-7 ${learningThai ? "text-base text-muted-foreground" : "text-lg font-semibold text-foreground"}`}>
        {exampleEn}
      </p>
    </div>
  );

  return <div className="mt-3 space-y-4">{learningThai ? [thai, english] : [english, thai]}</div>;
}

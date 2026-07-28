import { Loader2 } from "lucide-react";

type Props = {
  message?: string;
};

export function LoadingOverlay({ message = "กำลังโหลด..." }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
      <Loader2 className="w-10 h-10 text-brand animate-spin" />
      <p className="mt-4 text-sm text-zinc-400">{message}</p>
    </div>
  );
}

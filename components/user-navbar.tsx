"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LineChart, LogOut, User as UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { userLogout, type User } from "@/lib/user-api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LoadingOverlay } from "@/components/loading-overlay";

/**
 * The account corner of the app bar.
 *
 * It used to float in `position: fixed` over every page, wearing chrome designed for a
 * dark shell that no longer exists — `text-zinc-300` on `bg-white/10`, which measured
 * 1.41:1 against the light canvas and collided with each page's own header. It now sits
 * inside the bar, on the surface, in the app's language.
 */
/**
 * `user` is resolved once by the app bar (`lib/use-session.ts`) and passed down, rather
 * than fetched here. Fetching in this component meant a `GET /api/user/me` on every page
 * load for every visitor — including the logged-out majority, for whom it was a
 * guaranteed 401.
 */
export function UserNavbar({
  locale,
  user,
  onSignedOut,
}: {
  locale: string;
  user: User | null | undefined;
  /** Clears the lifted session state — see `lib/use-session.ts`. */
  onSignedOut: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("Nav");
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await userLogout();
      // Before the router call: pushing to a route we may already be on does not re-run
      // the session effect, and the bar would keep offering the account menu.
      onSignedOut();
      router.push(`/${locale}`);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  if (!user) {
    return (
      /*
        Both wear `play-key` — the app's one depth model: an ink rule sitting on a hard
        offset block that grows under the pointer and is pushed flat on press. Sign up
        used to be `play-press`, the only surface-level control in the app with neither
        rule nor block, so the bar's corner went from flat pill to `border-3 border-ink`
        the moment you signed in and the account button below took the same slot.

        `--lift` is 3px rather than the global 6px: a 44px button in a 64px bar has 10px
        of slack, and the hover state grows the block by another pixel.

        Focus needs nothing extra: `.play-key:focus-visible` already draws the house ink
        outline in `globals.css`.
      */
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          asChild
          variant="ghost"
          className="play-key h-11 rounded-full bg-card px-2.5 text-sm font-bold text-ink hover:bg-brand-soft sm:px-4 [--lift:3px]"
        >
          <Link href={`/${locale}/auth/login`}>{t("signIn")}</Link>
        </Button>

        <Button
          asChild
          className="play-key h-11 rounded-full bg-brand px-2.5 text-sm font-extrabold text-white hover:bg-brand sm:px-4 [--lift:3px]"
        >
          <Link href={`/${locale}/auth/register`}>{t("signUp")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      {loggingOut && <LoadingOverlay message={t("loggingOut")} />}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t("account")}
            className="play-key flex items-center gap-2 rounded-full bg-card p-1 font-semibold hover:bg-brand-soft sm:pr-3 [--lift:3px]"
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-brand text-sm font-bold text-white">
                {user.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <span className="hidden max-w-28 truncate text-sm sm:block">
              {user.username}
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 rounded-2xl">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link
              href={`/${locale}/progress`}
              prefetch={false}
              className="cursor-pointer"
            >
              <LineChart className="mr-2 size-4" />
              {t("progress")}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link
              href={`/${locale}/profile`}
              prefetch={false}
              className="cursor-pointer"
            >
              <UserIcon className="mr-2 size-4" />
              {t("profile")}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut className="mr-2 size-4" />
            {t("logOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

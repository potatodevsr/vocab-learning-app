"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, User as UserIcon } from "lucide-react";
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
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          className="play-underline play-focus h-11 rounded-full px-2 text-sm font-semibold text-ink hover:bg-brand-soft sm:px-3"
        >
          <Link href={`/${locale}/auth/login`}>{t("signIn")}</Link>
        </Button>

        <Button
          asChild
          className="play-press h-11 rounded-full bg-brand px-3 text-sm font-bold text-white hover:bg-brand sm:px-4"
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
            className="play-lift play-focus flex items-center gap-2 rounded-full border-3 border-ink bg-card p-1 font-semibold hover:bg-brand-soft sm:pr-3"
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
            onClick={handleLogout}
            disabled={loggingOut}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 size-4" />
            {t("logOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

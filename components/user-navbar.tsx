"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getMe, userLogout, type User } from "@/lib/user-api";
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
import { LogOut, User as UserIcon } from "lucide-react";
import { LoadingOverlay } from "@/components/loading-overlay";

export function UserNavbar({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    getMe().then(setUser);
  }, [pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await userLogout();
      setUser(null);
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
          size="sm"
          className="text-zinc-300 hover:text-white hover:bg-white/10"
        >
          <Link href={`/${locale}/auth/login`}>เข้าสู่ระบบ</Link>
        </Button>
        <Button
          asChild
          size="sm"
          className="rounded-full bg-pink-600 hover:bg-pink-500 text-white"
        >
          <Link href={`/${locale}/auth/register`}>สมัครสมาชิก</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      {loggingOut && <LoadingOverlay message="กำลังออกจากระบบ..." />}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10 transition-colors">
            <Avatar className="w-6 h-6">
              <AvatarFallback className="bg-pink-600 text-white text-xs">
                {user.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-white">{user.username}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{user.username}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/profile`} className="cursor-pointer">
              <UserIcon className="mr-2 h-4 w-4" />
              โปรไฟล์
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            ออกจากระบบ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

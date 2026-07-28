"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  BookOpen,
  Users,
  LayoutDashboard,
  LogOut,
  GraduationCap,
} from "lucide-react";
import { API_URL } from "@/constants/config";

const NAV_ITEMS = [
  {
    group: "จัดการ",
    items: [
      { label: "ภาพรวม", href: "/admin/dashboard", icon: LayoutDashboard },
      { label: "คำศัพท์", href: "/admin/vocabulary", icon: BookOpen },
    ],
  },
  {
    group: "ผู้ใช้งาน",
    items: [
      { label: "ผู้ใช้", href: "/admin/users", icon: Users },
      {
        label: "ประวัติการเรียน",
        href: "/admin/learning",
        icon: GraduationCap,
        disabled: true,
      },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/admin/login");
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Oxford 3000</p>
            <p className="text-xs text-muted-foreground mt-0.5">Admin Portal</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_ITEMS.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild={!item.disabled}
                    isActive={pathname === item.href}
                    disabled={item.disabled}
                    tooltip={item.disabled ? "เร็วๆ นี้" : undefined}
                  >
                    {item.disabled ? (
                      <span className="flex items-center gap-2 opacity-40 cursor-not-allowed">
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                        <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
                          Soon
                        </span>
                      </span>
                    ) : (
                      <Link
                        href={item.href}
                        className="flex items-center gap-2 transition-colors"
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="transition-colors hover:bg-danger-soft! hover:text-destructive!"
            >
              <LogOut className="w-4 h-4" />
              <span>ออกจากระบบ</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

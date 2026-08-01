"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { API_URL } from "@/constants/config";

const PAGE_SIZE = 50;

type User = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

type PaginatedResult = {
  data: User[];
  total: number;
  hasMore: boolean;
};

const fetchUsers = async (params: {
  take: number;
  skip: number;
  search?: string;
}): Promise<PaginatedResult> => {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { email: { contains: params.search } },
      { username: { contains: params.search } },
      { firstName: { contains: params.search } },
      { lastName: { contains: params.search } },
    ];
  }

  const query = new URLSearchParams({
    take: String(params.take),
    skip: String(params.skip),
    ...(Object.keys(where).length > 0 ? { where: JSON.stringify(where) } : {}),
    orderBy: JSON.stringify({ createdAt: "desc" }),
  });

  const res = await fetch(`${API_URL}/user/paginated?${query}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const result = await fetchUsers({
        take: PAGE_SIZE,
        skip: p * PAGE_SIZE,
        search: q || undefined,
      });
      setUsers(result.data);
      setTotal(result.total);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The request synchronizes this page with the remote admin data source.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(page, search);
  }, [page, search, load]);

  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(0);
      setSearch(val);
    }, 400);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="px-6 py-4 flex gap-3 flex-wrap items-center bg-background border-b">
        <div>
          <h1 className="font-semibold text-foreground">ผู้ใช้งาน</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            จัดการบัญชีผู้ใช้ทั้งหมด
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหา email, username, ชื่อ..."
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="pl-8 w-64 h-9"
            />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {total.toLocaleString()} คน
          </span>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="rounded-lg border bg-background shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>ชื่อ-นามสกุล</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>วันที่สมัคร</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-12 text-muted-foreground"
                  >
                    ไม่พบผู้ใช้งาน
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user, i) => (
                  <TableRow key={user.id}>
                    <TableCell className="text-center text-muted-foreground text-xs">
                      {page * PAGE_SIZE + i + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      @{user.username}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(user.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            หน้า {page + 1} จาก {totalPages || 1}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0 || loading}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              ก่อนหน้า
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1 || loading}
            >
              ถัดไป
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

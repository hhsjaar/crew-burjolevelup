"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { logout } from "@/actions/auth";
import {
  LayoutDashboard,
  CalendarCheck,
  ClipboardList,
  FileText,
  DollarSign,
  LogOut,
  Sparkles,
  Users,
  Menu,
  X,
  Wallet,
  MessageSquare,
  ShoppingBag,
} from "lucide-react";

interface SidebarProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  claimableCount?: number;
}

export default function Sidebar({ user, claimableCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const navItems = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
      adminOnly: false,
    },
    {
      label: "Absensi",
      icon: CalendarCheck,
      href: "/dashboard/attendance",
      adminOnly: false,
    },
    {
      label: "Jobdesk Kerja",
      icon: ClipboardList,
      href: "/dashboard/jobdesk",
      adminOnly: false,
      badge: user.role === "EMPLOYEE" && claimableCount > 0 ? claimableCount : undefined,
    },
    {
      label: "Daftar Belanja",
      icon: ShoppingBag,
      href: "/dashboard/shopping",
      adminOnly: false,
    },
    {
      label: "Izin & Cuti",
      icon: FileText,
      href: "/dashboard/leave",
      adminOnly: false,
    },
    {
      label: "Catatan & Kasbon",
      icon: Wallet,
      href: "/dashboard/notes",
      adminOnly: false,
    },
    {
      label: "Kelola Karyawan",
      icon: Users,
      href: "/dashboard/admin/users",
      adminOnly: true,
    },
    {
      label: "Jobdesk Shift Rutin",
      icon: ClipboardList,
      href: "/dashboard/admin/routine-jobdesk",
      adminOnly: true,
    },
    {
      label: "Rekap & Gaji",
      icon: DollarSign,
      href: "/dashboard/admin/payroll",
      adminOnly: true,
    },
    {
      label: "Pengaturan WA",
      icon: MessageSquare,
      href: "/dashboard/admin/whatsapp",
      adminOnly: true,
    },
  ];

  const [isOpen, setIsOpen] = useState(false);

  const toggleDrawer = () => setIsOpen(!isOpen);

  // Core mobile navigation tabs (excluding admin-only subpages)
  const mobileCoreTabs = navItems.filter(item => !item.adminOnly);

  return (
    <>
      {/* ======================================================== */}
      {/* DESKTOP SIDEBAR VIEW (LG SCREEN ONLY) */}
      {/* ======================================================== */}
      <aside className="hidden lg:flex w-72 shrink-0 glass-panel h-screen sticky top-0 flex-col z-20 border-r border-zinc-900">
        {/* Header Logo */}
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-bold text-black text-sm">
              B
            </div>
            <span className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
              burjolevelup
              <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            </span>
          </Link>
        </div>

        {/* User Info Block */}
        <div className="p-6 border-b border-zinc-900 flex items-center gap-4 bg-zinc-950/20">
          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-semibold text-zinc-300 text-sm shrink-0">
            {getInitials(user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm text-zinc-200 truncate leading-snug">{user.name}</h2>
            <p className="text-[11px] text-zinc-500 truncate mt-0.5">{user.email}</p>
            <span
              className={`inline-block text-[9px] font-bold uppercase px-2 py-0.5 rounded-full mt-2 border ${
                user.role === "ADMIN"
                  ? "bg-white/5 text-white border-white/20"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700"
              }`}
            >
              {user.role}
            </span>
          </div>
        </div>

        {/* Nav List */}
        <nav className="flex-1 p-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            if (item.adminOnly && user.role !== "ADMIN") return null;

            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-4 py-2.5 rounded-lg font-medium text-xs transition-all duration-200 border ${
                  isActive
                    ? "bg-zinc-900 border-zinc-800 text-white font-semibold"
                    : "bg-transparent border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-white" : "text-zinc-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-white text-black rounded-full shadow-sm">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer / Logout */}
        <div className="p-5 border-t border-zinc-900">
          <button
            onClick={async () => {
              await logout();
              window.location.href = "/login";
            }}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg font-semibold text-xs border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Keluar Aplikasi</span>
          </button>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* MOBILE HEADER VIEW (lg:hidden) */}
      {/* ======================================================== */}
      <header className="lg:hidden fixed top-0 left-0 w-full h-14 bg-black/60 backdrop-blur-md border-b border-zinc-900 flex items-center justify-between px-4 z-40">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white flex items-center justify-center font-bold text-black text-xs">
            B
          </div>
          <span className="font-bold text-sm text-white tracking-tight flex items-center gap-1">
            burjolevelup
            <Sparkles className="w-3 h-3 text-zinc-400" />
          </span>
        </Link>

        <button
          onClick={toggleDrawer}
          className="p-1.5 rounded-lg hover:bg-zinc-900 border border-zinc-900 text-zinc-300 hover:text-white transition-all cursor-pointer"
        >
          <Menu className="w-4.5 h-4.5" />
        </button>
      </header>



      {/* ======================================================== */}
      {/* MOBILE DRAWER OVERLAY & SIDE CONTAINER (lg:hidden) */}
      {/* ======================================================== */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          {/* Backdrop blur closer */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={toggleDrawer}
          />

          {/* Drawer side element */}
          <div className="relative w-68 h-full bg-zinc-950 border-l border-zinc-900 p-6 flex flex-col justify-between shadow-2xl z-10 animate-slide-in">
            <button
              onClick={toggleDrawer}
              className="absolute right-5 top-5 p-1 rounded-lg hover:bg-zinc-900 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            {/* Profile Block */}
            <div className="space-y-6 flex-1 overflow-y-auto pt-4">
              <div className="flex items-center gap-3.5 pb-4 border-b border-zinc-900">
                <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-semibold text-zinc-300 text-xs shrink-0">
                  {getInitials(user.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs text-white truncate">{user.name}</h3>
                  <p className="text-[10px] text-zinc-550 truncate">{user.email}</p>
                </div>
              </div>

              {/* Mobile Drawer Items (Admin links + core list items) */}
              <div className="space-y-4">
                <span className="block text-[8px] font-bold text-zinc-650 uppercase tracking-widest">MENU UTAMA</span>
                <nav className="space-y-1">
                  {navItems.map((item) => {
                    if (item.adminOnly && user.role !== "ADMIN") return null;

                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={toggleDrawer}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium text-xs transition-colors border ${
                          isActive
                            ? "bg-zinc-900 border-zinc-850 text-white"
                            : "bg-transparent border-transparent text-zinc-400 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span className="px-1 py-0.5 text-[8px] font-extrabold bg-white text-black rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Logout Footer inside drawer */}
            <div className="pt-4 border-t border-zinc-900">
              <button
                onClick={async () => {
                  await logout();
                  window.location.href = "/login";
                }}
                className="w-full flex items-center justify-center gap-2.5 px-3 py-2 rounded-lg font-semibold text-xs border border-zinc-850 hover:bg-zinc-900 text-zinc-450 hover:text-white transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Keluar Aplikasi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MOBILE BOTTOM FLOAT NAVIGATION BAR (lg:hidden) */}
      {/* ======================================================== */}
      <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-sm h-14 bg-zinc-950/70 backdrop-blur-xl border border-white/5 rounded-2xl flex items-center justify-around px-2 z-40 shadow-2xl">
        {mobileCoreTabs.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center w-12 h-12 relative transition-all duration-200"
            >
              <Icon
                className={`w-5 h-5 transition-transform duration-200 ${
                  isActive ? "text-white scale-105" : "text-zinc-550 hover:text-zinc-350"
                }`}
              />
              {item.badge !== undefined && (
                <span className="absolute top-1 right-1 px-1 py-0.25 text-[7px] font-bold bg-white text-black rounded-full leading-none shrink-0 shadow">
                  {item.badge}
                </span>
              )}
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-white mt-1 absolute bottom-1 animate-pulse" />
              )}
            </Link>
          );
        })}
      </div>

    </>
  );
}

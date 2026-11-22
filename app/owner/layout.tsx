"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  FileSpreadsheet,
  Briefcase,
  Users,
  Calendar,
  LogOut,
  Shield,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface OwnerLayoutProps {
  children: React.ReactNode;
}

const ownerNavItems = [
  { href: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner/approval", label: "Approval", icon: CheckSquare },
  { href: "/owner/rekap", label: "Rekap Upah", icon: FileSpreadsheet },
  { href: "/owner/proyek", label: "Proyek", icon: Briefcase },
  { href: "/owner/kalender", label: "Kalender", icon: Calendar },
  { href: "/owner/penjahit", label: "Penjahit", icon: Users },
];

export default function OwnerLayout({ children }: OwnerLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [ownerName, setOwnerName] = React.useState("Owner");
  const [ownerInitials, setOwnerInitials] = React.useState("OW");
  const [waitingCount, setWaitingCount] = React.useState<number>(0);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  React.useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("nama")
          .eq("id", user.id)
          .single();

        if (profile?.nama) {
          setOwnerName(profile.nama);
          const initials = profile.nama
            .split(" ")
            .map((n: string) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
          setOwnerInitials(initials || "OW");
        }
      }

      // Ambil jumlah entri yang sedang menunggu approval
      const { count } = await supabase
        .from("production_entries")
        .select("*", { count: "exact", head: true })
        .eq("status", "menunggu");

      if (count !== null && count !== undefined) {
        setWaitingCount(count);
      }
    }
    loadData();
  }, [pathname]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col justify-between">
      {/* Header Desktop & Mobile */}
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-md border-b border-line/60 px-4 sm:px-6 lg:px-8 py-3 w-full">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4">
          {/* Sapaan & Profil Kiri */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-forest-900 text-lime-400 font-semibold text-[14px] flex items-center justify-center select-none shadow-sm">
              {ownerInitials}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Owner Admin
                </p>
                <Shield className="w-3 h-3 text-positive" />
              </div>
              <h2 className="text-[17px] sm:text-[19px] font-semibold text-ink leading-tight truncate max-w-[160px] sm:max-w-xs">
                Halo, {ownerName}
              </h2>
            </div>
          </div>

          {/* Desktop Navigasi: Tab Pill di Tengah Sesuai design-fchub.md */}
          <nav
            aria-label="Navigasi desktop owner"
            className="hidden md:flex items-center p-1 bg-surface-muted rounded-pill border border-line/60"
          >
            {ownerNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === "/owner/dashboard" && pathname === "/owner");
              const isApproval = item.href === "/owner/approval";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-1.5 rounded-pill text-[13px] font-medium transition-all duration-150 flex items-center gap-1.5 ${
                    isActive
                      ? "bg-lime-500 text-forest-900 font-semibold shadow-sm"
                      : "text-muted hover:text-ink hover:bg-surface/60"
                  }`}
                >
                  <item.icon className="w-4 h-4 stroke-[2]" />
                  <span>{item.label}</span>
                  {isApproval && waitingCount > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                        isActive
                          ? "bg-forest-900 text-white"
                          : "bg-warning text-white"
                      }`}
                    >
                      {waitingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Aksi Kanan: Tombol Keluar */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              aria-label="Keluar dari sistem"
              title="Keluar"
              className="flex items-center gap-1.5 h-10 px-3 sm:px-4 rounded-pill bg-surface border border-line text-muted hover:text-negative hover:border-negative/30 transition text-[13px] font-medium active:scale-95"
            >
              <LogOut className="w-4 h-4 stroke-[2]" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Konten Halaman */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation (6 Item) */}
      <nav
        aria-label="Navigasi bawah owner"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-line/80 rounded-t-[24px] shadow-[0_-4px_20px_rgba(15,26,18,0.06)] h-16 max-w-lg mx-auto flex items-center justify-between px-1"
      >
        {ownerNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/owner/dashboard" && pathname === "/owner");
          const Icon = item.icon;
          const isApproval = item.href === "/owner/approval";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 px-0.5 rounded-pill transition-all duration-150 relative ${
                isActive
                  ? "bg-lime-500 text-forest-900 font-semibold scale-105"
                  : "text-muted hover:text-ink"
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4 stroke-[2]" />
                {isApproval && waitingCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] px-1 rounded-full bg-warning text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {waitingCount}
                  </span>
                )}
              </div>
              <span className="text-[9.5px] leading-tight mt-0.5 font-medium truncate max-w-full">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Modal Konfirmasi Logout */}
      <Dialog
        isOpen={isLogoutModalOpen}
        onClose={() => !isLoggingOut && setIsLogoutModalOpen(false)}
        title="Yakin untuk keluar?"
        subtitle="Sesi Anda akan diakhiri dan dialihkan kembali ke halaman masuk."
      >
        <div className="space-y-4 pt-1">
          <p className="text-[13px] text-muted leading-relaxed">
            Pastikan semua pekerjaan Anda telah tersimpan sebelum keluar dari sistem FCHub.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsLogoutModalOpen(false)}
              disabled={isLoggingOut}
              className="flex-1 sm:flex-initial"
            >
              Tidak
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex-1 sm:flex-initial bg-forest-900 text-white"
            >
              {isLoggingOut ? "Keluar..." : "Iya"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

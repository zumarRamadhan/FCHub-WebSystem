"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, PlusCircle, Clock, Trophy, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PenjahitLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/penjahit/beranda", label: "Beranda", icon: Home },
  { href: "/penjahit/input", label: "Input", icon: PlusCircle },
  { href: "/penjahit/riwayat", label: "Riwayat", icon: Clock },
  { href: "/penjahit/leaderboard", label: "Peringkat", icon: Trophy },
];

export default function PenjahitLayout({ children }: PenjahitLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = React.useState("Penjahit");
  const [userInitials, setUserInitials] = React.useState("P");
  const [isLogoutModalOpen, setIsLogoutModalOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  React.useEffect(() => {
    async function loadUser() {
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
          setUserName(profile.nama);
          const initials = profile.nama
            .split(" ")
            .map((n: string) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
          setUserInitials(initials || "P");
        }
      }
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col justify-between">
      {/* Header Mobile & Desktop */}
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-md border-b border-line/60 px-4 sm:px-6 py-3.5 max-w-4xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-forest-900 text-lime-400 font-semibold text-[14px] flex items-center justify-center select-none shadow-sm">
            {userInitials}
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted leading-tight">Penjahit Konveksi</p>
            <h2 className="text-[18px] sm:text-[20px] font-semibold text-ink leading-tight truncate max-w-[200px] sm:max-w-xs">
              Halo, {userName}
            </h2>
          </div>
        </div>

        {/* Tombol Keluar */}
        <button
          type="button"
          onClick={() => setIsLogoutModalOpen(true)}
          aria-label="Keluar dari akun"
          title="Keluar"
          className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-surface border border-line text-muted hover:text-negative hover:border-negative/30 flex items-center justify-center transition active:scale-95"
        >
          <LogOut className="w-4 h-4 stroke-[2]" />
        </button>
      </header>

      {/* Konten Halaman (diberi padding bawah pb-24 agar tidak tertutup bottom nav) */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-24">
        {children}
      </main>

      {/* Bottom Navigation (4 Item sesuai design-fchub.md) */}
      <nav
        aria-label="Navigasi bawah penjahit"
        className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-line/80 rounded-t-[24px] shadow-[0_-4px_20px_rgba(15,26,18,0.06)] h-16 max-w-md mx-auto flex items-center justify-around px-2"
      >
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/penjahit/beranda" && pathname === "/penjahit");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] py-1 px-2.5 rounded-pill transition-all duration-150 ${
                isActive
                  ? "bg-lime-500 text-forest-900 font-semibold scale-105"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Icon className="w-5 h-5 stroke-[2]" />
              <span className="text-[11px] leading-tight mt-0.5">
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
            Pastikan setoran jahitan hari ini sudah terkirim sebelum Anda keluar dari akun FCHub.
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

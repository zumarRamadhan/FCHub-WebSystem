"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, AlertCircle, ArrowRight, Package } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatInternalEmail } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setErrorMsg("Masukkan username Anda.");
      return;
    }

    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setErrorMsg("PIN harus terdiri dari 6 digit angka.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const internalEmail = formatInternalEmail(cleanUsername);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password: pin,
      });

      if (error || !data.user) {
        setErrorMsg("Username atau PIN salah.");
        setIsLoading(false);
        return;
      }

      // Ambil peran pengguna untuk pengalihan instan
      const { data: profile } = await supabase
        .from("users")
        .select("role, aktif")
        .eq("id", data.user.id)
        .single();

      if (profile && !profile.aktif) {
        await supabase.auth.signOut();
        setErrorMsg("Akun ini telah dinonaktifkan oleh owner.");
        setIsLoading(false);
        return;
      }

      if (profile?.role === "owner") {
        router.push("/owner");
      } else {
        router.push("/penjahit");
      }
      router.refresh();
    } catch {
      setErrorMsg("Terjadi kendala koneksi. Silakan coba lagi.");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header Brand */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-[16px] bg-lime-500 text-forest-900 mx-auto flex items-center justify-center mb-3 shadow-sm">
            <Package className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h1 className="text-[24px] font-semibold text-ink leading-tight">
            FCHub
          </h1>
          <p className="text-[13px] text-muted mt-1">
            Konveksi Tas Firdaus Collection
          </p>
        </div>

        {/* Kartu Form Login */}
        <Card className="p-6 sm:p-7 shadow-card">
          <CardHeader
            className="mb-4"
            icon={<Lock className="w-5 h-5 text-forest-900" />}
            title="Masuk ke Akun"
            subtitle="Gunakan username dan PIN 6 digit"
          />

          <CardContent className="p-0">
            {errorMsg && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-panel bg-negative/10 border border-negative/20 text-negative text-[13px] flex items-center gap-2 animate-in fade-in duration-200"
              >
                <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5"
                >
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="misal: budi"
                  disabled={isLoading}
                  className="w-full h-12 px-4 rounded-control bg-surface-muted border border-line text-ink text-[14px] placeholder:text-muted/50 focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900 transition"
                />
              </div>

              <div>
                <label
                  htmlFor="pin"
                  className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5"
                >
                  PIN 6 Digit
                </label>
                <input
                  id="pin"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="current-password"
                  value={pin}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, "");
                    setPin(cleaned);
                  }}
                  placeholder="••••••"
                  disabled={isLoading}
                  className="w-full h-12 px-4 rounded-control bg-surface-muted border border-line text-ink text-center text-[18px] tracking-[0.3em] font-semibold tabular-nums placeholder:text-muted/40 focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900 transition"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full h-12 text-[14px]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    "Memeriksa..."
                  ) : (
                    <>
                      <span>Masuk</span>
                      <ArrowRight className="ml-1.5 w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Catatan Kaki Bantuan */}
        <p className="text-center text-[12px] text-muted mt-6">
          Lupa PIN atau belum punya akun? Hubungi owner konveksi.
        </p>
      </div>
    </main>
  );
}

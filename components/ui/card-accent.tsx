import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardAccentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  showDecoration?: boolean;
}

/**
 * CardAccent: Kartu aksen warna lime-500 dengan teks forest-900.
 * Aturan design-fchub.md:
 * - Hanya ada satu kartu aksen lime per layar.
 * - Kontras teks di atas lime selalu forest-900 (tidak pernah putih).
 * - Dekorasi halus berupa ikon bintang / pola tipis di pojok kanan atas.
 */
export function CardAccent({
  className,
  children,
  showDecoration = true,
  ...props
}: CardAccentProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-lime-500 text-forest-900 rounded-card p-5 sm:p-6 shadow-card transition-all",
        className
      )}
      {...props}
    >
      {showDecoration && (
        <div className="absolute -bottom-2 right-4 text-forest-900/15 pointer-events-none select-none">
          <Sparkles className="w-14 h-14" strokeWidth={1.5} />
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

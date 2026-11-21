import * as React from "react";
import { Clock, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type EntryStatus = "menunggu" | "disetujui" | "ditolak";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: EntryStatus;
  label?: string;
}

const statusConfig: Record<
  EntryStatus,
  {
    bgClass: string;
    textClass: string;
    icon: React.ReactNode;
    defaultLabel: string;
  }
> = {
  menunggu: {
    bgClass: "bg-warning/15",
    textClass: "text-[#B77407]",
    icon: <Clock className="w-3.5 h-3.5 stroke-[2]" />,
    defaultLabel: "Menunggu",
  },
  disetujui: {
    bgClass: "bg-lime-100",
    textClass: "text-positive",
    icon: <Check className="w-3.5 h-3.5 stroke-[2.5]" />,
    defaultLabel: "Disetujui",
  },
  ditolak: {
    bgClass: "bg-negative/12",
    textClass: "text-negative",
    icon: <X className="w-3.5 h-3.5 stroke-[2.5]" />,
    defaultLabel: "Ditolak",
  },
};

/**
 * StatusBadge: Menampilkan status entri input produksi.
 * Sesuai design-fchub.md:
 * Selalu menampilkan teks dan ikon, bukan warna saja.
 */
export function StatusBadge({
  status,
  label,
  className,
  ...props
}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-6 px-2.5 rounded-pill text-[12px] font-medium leading-[16px] select-none",
        config.bgClass,
        config.textClass,
        className
      )}
      {...props}
    >
      {config.icon}
      <span>{label || config.defaultLabel}</span>
    </span>
  );
}

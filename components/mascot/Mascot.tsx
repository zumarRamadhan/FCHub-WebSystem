"use client";

import * as React from "react";
import Image from "next/image";
import { MascotPose, getMascotAsset } from "@/lib/mascot";

export interface MascotProps {
  pose: MascotPose;
  size?: number | "sm" | "md" | "lg" | "xl";
  animate?: boolean;
  priority?: boolean;
  className?: string;
}

const SIZE_PRESETS: Record<string, number> = {
  sm: 72,
  md: 96,
  lg: 120,
  xl: 180,
};

export function Mascot({
  pose,
  size = "md",
  animate = true,
  priority = false,
  className = "",
}: MascotProps) {
  const asset = getMascotAsset(pose);
  const targetHeight = typeof size === "number" ? size : SIZE_PRESETS[size] || 96;
  const aspectRatio = asset.width / asset.height;
  const targetWidth = Math.round(targetHeight * aspectRatio);

  const animClass = !animate
    ? ""
    : pose === "ajakan"
    ? "anim-mascot-ajakan"
    : pose === "tercapai"
    ? "anim-mascot-tercapai"
    : pose === "melampaui"
    ? "anim-mascot-melampaui"
    : pose === "istirahat"
    ? "anim-mascot-istirahat"
    : pose === "gagal"
    ? "anim-mascot-gagal"
    : "anim-mascot-belum-capai";

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${!animate ? "mascot-no-motion" : ""} ${className}`}
      style={{ width: targetWidth, height: targetHeight }}
      aria-hidden="true"
    >
      {/* Gambar Maskot Fiko */}
      <div className={`relative w-full h-full ${animClass}`}>
        <Image
          src={asset.src}
          alt=""
          width={targetWidth}
          height={targetHeight}
          priority={priority}
          className="w-full h-full object-contain pointer-events-none select-none drop-shadow-sm"
        />

        {/* 4 Partikel Bintang CSS Berkilau Khusus Pose Melampaui */}
        {pose === "melampaui" && animate && (
          <>
            <span
              className="anim-sparkle absolute -top-1 -right-1 text-amber-400 text-xs font-bold pointer-events-none select-none"
              style={{ animationDelay: "0.1s" }}
            >
              ✦
            </span>
            <span
              className="anim-sparkle absolute top-2 -left-2 text-lime-500 text-[10px] font-bold pointer-events-none select-none"
              style={{ animationDelay: "0.4s" }}
            >
              ★
            </span>
            <span
              className="anim-sparkle absolute bottom-4 -right-2 text-yellow-400 text-[11px] font-bold pointer-events-none select-none"
              style={{ animationDelay: "0.7s" }}
            >
              ✦
            </span>
            <span
              className="anim-sparkle absolute -bottom-1 left-2 text-amber-300 text-[9px] font-bold pointer-events-none select-none"
              style={{ animationDelay: "0.3s" }}
            >
              ★
            </span>
          </>
        )}
      </div>
    </div>
  );
}

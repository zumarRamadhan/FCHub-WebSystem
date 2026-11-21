"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function PenjahitError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-6 text-center shadow-card">
        <div className="w-12 h-12 rounded-[16px] bg-negative/10 text-negative mx-auto flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 stroke-[2.5]" />
        </div>
        <h2 className="text-[18px] font-semibold text-ink">Gagal Memuat Data</h2>
        <p className="text-[13px] text-muted mt-1.5 mb-6">
          Terjadi kendala saat memuat data penjahit. Silakan coba kembali beberapa saat lagi.
        </p>
        <Button variant="primary" onClick={() => reset()} className="w-full">
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Coba Lagi
        </Button>
      </Card>
    </div>
  );
}

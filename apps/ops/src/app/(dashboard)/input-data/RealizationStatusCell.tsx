"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RealizationStatusBadge } from "./RealizationStatusBadge";
import { confirmMismatchedRealization } from "./actions";

export function RealizationStatusCell({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (status !== "menunggu_konfirmasi_pd") {
    return <RealizationStatusBadge status={status} />;
  }

  const confirm = async () => {
    setBusy(true);
    await confirmMismatchedRealization(id);
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <RealizationStatusBadge status={status} />
      <button
        disabled={busy}
        onClick={confirm}
        className="text-[11px] font-semibold text-primary disabled:opacity-50"
      >
        {busy ? "Mengonfirmasi…" : "Nilai ini tetap benar →"}
      </button>
    </div>
  );
}

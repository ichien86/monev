"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

type WorkUnitOption = { _id: string; name: string };

export function LaporanFilterBar({ workUnits }: { workUnits: WorkUnitOption[] }) {
  const router = useRouter();
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [workUnitId, setWorkUnitId] = useState("");

  const exportUrl = (() => {
    const params = new URLSearchParams();
    if (periodYear) params.set("periodYear", String(periodYear));
    if (workUnitId) params.set("workUnitId", workUnitId);
    return `/api/export/final-values?${params.toString()}`;
  })();

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-mono text-muted uppercase tracking-wide">Tahun</span>
        <input
          type="number"
          value={periodYear}
          onChange={(e) => setPeriodYear(Number(e.target.value))}
          className="w-28 px-3 py-2 rounded-lg border border-border text-sm font-mono"
        />
      </label>
      {workUnits.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">PD</span>
          <select
            value={workUnitId}
            onChange={(e) => setWorkUnitId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border text-sm"
          >
            <option value="">Semua PD</option>
            {workUnits.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        onClick={() => router.push(`?year=${periodYear}${workUnitId ? `&workUnitId=${workUnitId}` : ""}`)}
        className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-primary"
      >
        Terapkan Filter
      </button>
      <a
        href={exportUrl}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
      >
        <Download size={14} /> Ekspor CSV
      </a>
    </div>
  );
}

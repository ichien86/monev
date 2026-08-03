"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSchedule } from "./actions";

type Option = { _id: string; label: string };

const SCOPE_LABEL: Record<string, string> = {
  pelaporan_indikator: "Pelaporan Indikator (F-04)",
  penentuan_target: "Penentuan Target (boleh dibuka ulang)",
  penutupan_tahun: "Penutupan Tahun (sistem-lebar)",
};

export function ScheduleForm({ indicatorOptions }: { indicatorOptions: Option[] }) {
  const router = useRouter();
  const [scope, setScope] = useState<"pelaporan_indikator" | "penentuan_target" | "penutupan_tahun">(
    "pelaporan_indikator"
  );
  const [refId, setRefId] = useState("");
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodLabel, setPeriodLabel] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsTarget = scope !== "penutupan_tahun";

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await createSchedule({
      scope,
      refId: needsTarget ? refId : "000000000000000000000000",
      periodYear,
      periodLabel,
      deadlineAt: new Date(deadline).toISOString(),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRefId("");
    setPeriodLabel("");
    setDeadline("");
    router.refresh();
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Jenis Jadwal</span>
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as typeof scope);
              setRefId("");
            }}
            className="px-3 py-2 rounded-lg border border-border text-sm"
          >
            {Object.entries(SCOPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {needsTarget && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-mono text-muted uppercase tracking-wide">Indikator</span>
            <select value={refId} onChange={(e) => setRefId(e.target.value)} className="px-3 py-2 rounded-lg border border-border text-sm">
              <option value="">— Pilih —</option>
              {indicatorOptions.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Periode</span>
          <div className="flex gap-2">
            <input
              type="number"
              value={periodYear}
              onChange={(e) => setPeriodYear(Number(e.target.value))}
              className="w-24 px-3 py-2 rounded-lg border border-border text-sm font-mono"
            />
            <input
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="cth. Triwulan II"
              className="flex-1 px-3 py-2 rounded-lg border border-border text-sm"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Tenggat</span>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border text-sm"
          />
        </label>
      </div>
      {error && <div className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">{error}</div>}
      <button
        disabled={busy || (needsTarget && !refId) || !periodLabel || !deadline}
        onClick={submit}
        className="self-start px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "Menyimpan…" : "Buat Jadwal"}
      </button>
    </div>
  );
}

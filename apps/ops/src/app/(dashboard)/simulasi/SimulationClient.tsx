"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { simulateCapaian } from "./actions";

type IndicatorOption = { _id: string; label: string; targets: { year: number; value: string }[] };

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  tercapai: { label: "Tercapai", className: "bg-success-tint text-success" },
  proses: { label: "Proses", className: "bg-accent-tint text-accent" },
  belum_tercapai: { label: "Belum Tercapai", className: "bg-danger-tint text-danger" },
};

export function SimulationClient({ indicators }: { indicators: IndicatorOption[] }) {
  const [indicatorId, setIndicatorId] = useState(indicators[0]?._id ?? "");
  const [hypotheticalValue, setHypotheticalValue] = useState("");
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [result, setResult] = useState<{ capaianPercent: number; status: string; targetUsed: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await simulateCapaian(indicatorId, hypotheticalValue, targetYear);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(res.data);
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-6 max-w-xl">
      <div className="flex items-center gap-2 mb-4">
        <FlaskConical size={16} className="text-primary" />
        <span className="text-sm font-semibold text-ink">Simulator Capaian</span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-mono text-muted uppercase tracking-wide">Indikator</span>
        <select
          value={indicatorId}
          onChange={(e) => setIndicatorId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border text-sm"
        >
          {indicators.map((i) => (
            <option key={i._id} value={i._id}>
              {i.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Tahun Target</span>
          <input
            type="number"
            value={targetYear}
            onChange={(e) => setTargetYear(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-border text-sm font-mono"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono text-muted uppercase tracking-wide">Nilai Hipotetis</span>
          <input
            value={hypotheticalValue}
            onChange={(e) => setHypotheticalValue(e.target.value)}
            placeholder="cth. 2,1"
            className="px-3 py-2 rounded-lg border border-border text-sm font-mono"
          />
        </label>
      </div>

      <button
        disabled={busy || !indicatorId || !hypotheticalValue}
        onClick={run}
        className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "Menghitung…" : "Jalankan Simulasi"}
      </button>

      {error && <div className="text-sm text-danger bg-danger-tint rounded-lg px-3 py-2 mt-4">{error}</div>}

      {result && (
        <div className="mt-5 p-4 rounded-lg bg-bg border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted uppercase">Hasil Simulasi</span>
            <span
              className={`font-mono text-[10.5px] font-semibold px-2.5 py-1 rounded-full ${STATUS_LABEL[result.status]?.className}`}
            >
              {STATUS_LABEL[result.status]?.label}
            </span>
          </div>
          <div className="font-mono text-3xl font-semibold text-ink mt-2">{result.capaianPercent}%</div>
          <div className="text-[11.5px] text-muted mt-1">Dibandingkan target: {result.targetUsed}</div>
        </div>
      )}

      <div className="text-[11px] text-faint mt-4">
        Simulasi ini murni komputasi — tidak pernah menyimpan apa pun ke database (PRD F-07, DDT
        Section 4.B).
      </div>
    </div>
  );
}
